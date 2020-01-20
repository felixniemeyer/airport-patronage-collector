const rp = require('request-promise')
const qs = require('querystring') 
const fs = require('fs') 
const csv = require('csv-parser') 

const BATCH_SIZE = 50
const PARALLEL_QUERIES = 1
const API_ENDPOINT = 'https://query.wikidata.org/sparql'

let batch = []

fs.createReadStream('./relevant-airports.csv') 
  .pipe(csv({ 
    headers: ['open_flights_id', 'iata', 'icao', 'label']
  }))
  .on('data', data => { 
    batch.push(data) 
    if(batch.length >= BATCH_SIZE) {
      queueQuerie(batch) 
      batch = []
    }
  })
  .on('end', () => {
    if(batch.length > 0) {
      queueQuerie(batch) 
    }
  })

let jobQueue = []
let activeQueries = 0
let terminate = false
function queueQuerie(batch) {
  jobQueue.push(batch) 
  tryToStartNextJob()
}

function tryToStartNextJob() {
  if(
    activeQueries < PARALLEL_QUERIES && 
    jobQueue.length > 0 &&
    !terminate) {
    terminate = true // debug, do only one query
    startQuery(jobQueue.shift())   
  }
}

function startQuery(batch) {
  activeQueries++
  
  let icao_code_list = batch.map(row => `"${row['icao']}"`).join(", ") 
  let query = `
    SELECT ?icao ?patronage ?point_in_time WHERE {
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
      VALUES ?airport_classes { wd:Q1248784 wd:Q62447 wd:Q644371 }
      ?airport wdt:P31 ?airport_classes.
      ?airport p:P3872 ?patronage_statement.
      ?patronage_statement ps:P3872 ?patronage.
      ?patronage_statement pq:P585 ?point_in_time.
      ?airport p:P239 ?icao_statement. 
      ?icao_statement ps:P239 ?icao.
      FILTER ( ?icao IN ( ${icao_code_list} ) )
      FILTER ( YEAR(?point_in_time) < 2018 && YEAR(?point_in_time) > 2010 )
    }
  `
  let httpGetParams = qs.encode({ query })

  let requestOptions = {
    url: API_ENDPOINT + '?' + httpGetParams, 
    headers: {
      'Host': 'query.wikidata.org',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:71.0) Gecko/20100101 Firefox/71.0',
      'Accept': 'application/sparql-results+json',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    json: true
  }

  rp(requestOptions)
    .then(res => {
      console.log(JSON.stringify(res.results.bindings))
      activeQueries--
      tryToStartNextJob()
    })
    .catch(console.error) 
}
