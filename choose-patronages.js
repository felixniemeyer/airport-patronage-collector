const splitSet = require('./split-set.js')

function restructure(bindings) {
  let restructured = {}
  bindings.forEach(binding => {
    let icao = parseIcao(binding.icao)
    let patronage = parsePatronage(binding.patronage) 
    let [year, month] = parsePointInTime(binding.point_in_time)
    if( 
        patronage === undefined || 
        year === undefined ||
        month === undefined ) {
      console.error('failed to parse binding', binding)
      return
    }

    if(restructured[icao] === undefined) {
      restructured[icao] = {
      }
    }

    if(restructured[icao][year] === undefined) {
      restructured[icao][year] = {}
    }

    if(restructured[icao][year][month] === undefined) {
      restructured[icao][year][month] = []
    }

    restructured[icao][year][month].push(patronage)
  })
  return restructured
}

function parseIcao(icao) {
  return icao.value
}

function parsePatronage(patronage) {
  if( 
    patronage.datatype != 'http://www.w3.org/2001/XMLSchema#decimal' || 
    patronage.type !== 'literal' ) {
    console.error('unexpected patronage datatype')
    return undefined
  } else {
    return parseInt(patronage.value)
  }
}
    
function parsePointInTime(point_in_time) {
  if (
    point_in_time.datatype != 'http://www.w3.org/2001/XMLSchema#dateTime' ||
    point_in_time.type !== 'literal' ) {
    console.error('unexpected point_in_time datatype')
    return undefined
  } 
  let components = point_in_time.value.split('-')
  let year = components[0]
  let month = components[1]
  let rest = components[2]
  if( rest !== '01T00:00:00Z') {
    console.error('unexpected point_in_time value', point_in_time.value)
    return [undefined, undefined]
  }
  return [year, month].map(n => parseInt(n))
}

module.exports = function choosePatronages(bindings) {
  /*
    values can be either per year or per month.
    if the date is different from Jan. 1 it's probably a value per month
    if there are multiple values for Jan. 1, some may be per year an some per month
      per month values are expected to be 1/12 of the value per year  
  */
  let restructured = restructure(bindings) 

  let results = {}
  let setResult = (icao, year, patronage) => {
    patronage = parseInt(patronage) 
    if(patronage > 0) {
      if(results[icao] === undefined) {
        results[icao] = {}
      }
      results[icao][year] = patronage
    }
  }
  for(icao in restructured) {
    for(year in restructured[icao]) {
      if(Object.keys(restructured[icao][year]).length === 1) { // info only about one kind of month
        if(restructured[icao][year][1] !== undefined) { // info only in Januaries
          let yearly_patronages = restructured[icao][year][1]
          let avg_patr = yearly_patronages.reduce((a, b) => a + b) / yearly_patronages.length
          setResult(icao, year, avg_patr)
        } else { 
          // not sure how to interpret
        }
      } else { // there is data for various kind of months
        let allValues = []
        for(month in restructured[icao][year]) {
          for(patronage of restructured[icao][year][month]) {
            allValues.push(patronage) 
          }
        }
        let info = splitSet(allValues) 
        if( info.lower_mean * 6 < info.upper_mean ) { // assume we have monthly and yearly values
          setResult(icao, year, info.upper_mean)
        } else { // assume we only have monthly data
          let avg_monthly_patronages = allValues.reduce((a,b) => a + b) / allValues.length
          setResult(icao, year, avg_monthly_patronages * 12)
        }
      }
    }
  }
  return results
}
