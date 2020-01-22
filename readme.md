### get data from wikidata
go to query.wikidata.org
enter query ```sparql-queries/get-all-airports-with-patronage-values.sparql```

click download, choose csv, save as ```wikidata-patronages.csv```

### choose patronage

put a file  ```custom_aiport_ids``` in the root directory containing rows in the format: ```"<custom_airport_id>|<iata>|<icao>"```

run ```node extract-yearly-patronage.js```

run ```node estimate-2014-patronage.js```

output file is called ```estimated-2014-patronage.csv```



