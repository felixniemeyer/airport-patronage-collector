const choosePatronages = require("../choose-patronages.js")
const fs = require("fs").promises

fs.readFile('./sample-query-result-bindings.json')
  .then(data => {
    let bindings = JSON.parse(data)
    let patronages = choosePatronages(bindings) 
    console.log(patronages) 
  })
