const fs = require('fs')
const colorConvert = require('color-convert')
const getImageColors = require('get-image-colors')
const mime = require('mime-types')
const path = require('path')
const pickAGoodColor = require('pick-a-good-color')
const revHash = require('rev-hash')
const stringify = require('json-stable-stringify')
const apps = require('../lib/raw-app-list')()

// load the colors generated during the last session
const colorsFile = path.normalize(path.join(__dirname, '../meta/colors.json'))
let oldColors
try {
  oldColors = require(colorsFile)
} catch(e) {
  oldColors = {}
}

// generate new color info for apps that need it
console.log(`generating ${colorsFile}...`)
Promise.all(
  apps.map(async (app) => {
    const slug = app.slug
    try {
      const data = fs.readFileSync(app.iconPath)
      const hash = revHash(data)

      // if nothing's changed, don't recalculate
      let o = oldColors[slug]
      if (o && o.source && o.source.revHash === hash) return {[slug]: o}

      console.log(`calculating good colors for ${slug}`)
      return await getImageColors(data, mime.lookup(app.iconPath))
        .then(iconColors => {
          const palette = iconColors.map(color => color.hex())
          const goodColorOnWhite = pickAGoodColor(palette)
          const goodColorOnBlack = pickAGoodColor(palette, {background: 'black'})
          const faintColorOnWhite = `rgba(${colorConvert.hex.rgb(goodColorOnWhite).join(', ')}, 0.1)`
          const iconPath = path.relative(path.join(__dirname, '..'), app.iconPath)
          return {[slug]: {source: {revHash: hash, path: iconPath}, palette, goodColorOnWhite, goodColorOnBlack, faintColorOnWhite}}
        })
    } catch (e) {
      console.error(`Error processing ${app.iconPath}`)
      console.error(e)
    }
  })
)
.then(values => {
  const colors = Object.assign({}, ...values)
  fs.writeFileSync(colorsFile, stringify(colors, {space: 2}))
})
.catch(e => console.error(e))
