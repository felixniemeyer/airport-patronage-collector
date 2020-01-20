const rp = require('request-promise')
const qs = require('querystring') 
const fs = require('fs') 
const rl = require('readline') 

const choosePatronage = require('./icao_list.js') 

const BATCH_SIZE = 50
const PARALLEL_QUERIES = 5
const API_ENDPOINT = 'https://query.wikidata.org/sparql'

const FROM_YEAR = 2011
const TO_YEAR = 2017
const YEARS = Array(TO_YEAR + 1 - FROM_YEAR).fill().map((v,i) => FROM_YEAR + i)

let batch = []

let ws = fs.createWriteStream('./patronages.csv')
ws.write(['icao'].concat(YEARS).join(",") + '\n')

let lastJobEnqueued = false
rl.createInterface({
  input: fs.createReadStream('./relevant-airports') 
})
  .on('line', line => { 
    batch.push(line) 
    if(batch.length >= BATCH_SIZE) {
      queueJob({icao_list: batch}) 
      batch = []
    }
  })
  .on('close', () => {
    if(batch.length > 0) {
      queueJob({icao_list: batch}) 
    }
    lastJobEnqueued = true
  })

let jobQueue = []
let jobId = 0
let runningJobs = 0
function queueJob(job) {
  job.id = jobId++
  jobQueue.push(job) 
  setTimeout(tryToStartNextJob)
}

function tryToStartNextJob() {
  if(jobQueue.length > 0) {
    if(runningJobs < PARALLEL_QUERIES) {
      startJob(jobQueue.shift())   
    } 
  } else if(lastJobEnqueued && runningJobs === 0) {
    ws.end()
  }
}

function finishJob(job) {
  runningJobs--
  setTimeout(tryToStartNextJob)
}

function startJob(job) {
  runningJobs++
  console.log('starting query for job: ', job.id, ' currently running', runningJobs) 
  setTimeout(tryToStartNextJob)
  query(job.icao_list)
    .then(() => { finishJob(job) })
}

function query(icao_list) {
  let icao_code_list = icao_list.map(icao => `"${icao}"`).join(", ") 
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
      FILTER ( YEAR(?point_in_time) < ${TO_YEAR+1} && YEAR(?point_in_time) > ${FROM_YEAR-1} )
    }
  `

  console.log(query) 

  let httpGetParams = qs.encode({ query })

  let requestOptions = {
    url: API_ENDPOINT + '?' + httpGetParams, 
    headers: {
      'Host': 'query.wikidata.org',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:71.0) Gecko/20100101 Firefox/71.0',
      'Accept': 'application/sparql-results+json',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    json: true,
    simple: false
  }

  return rp(requestOptions)
    .then(res => {
      console.log(res.results.bindings) 
      let results = choosePatronage(res.results.bindings)
      for(let icao in results) {
        let values = [icao].concat(YEARS.map(year => results[icao][year] || 'unavailable'))
        ws.write(values.join(',') + '\n')
      }
    })
    .catch(console.error) 
}
