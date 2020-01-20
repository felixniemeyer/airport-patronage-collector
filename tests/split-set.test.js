const splitSet = require('../split-set.js')

console.log(
  splitSet(
    Array(20)
      .fill()
      .map(i => Math.random())
  )
)

console.log(
splitSet(
  Array(48)
    .fill()
    .map(i => Math.round((Math.random() * 200 + 100) * (Math.random() < 1/12 ? 12 : 1) ))
)
)
