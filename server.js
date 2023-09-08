const fs = require('fs');
const express = require('express');
const { Client } = require('@elastic/elasticsearch');
const app = express();
const PORT = 3000;

// Create an Elasticsearch client
const elasticClient = new Client({
    node: 'https://localhost:9200',
    auth: {
        username: 'elastic',
        password: 'change_me'
    },
    tls: {
        rejectUnauthorized: false,
        ca: fs.readFileSync('./resources/http_ca.crt'),
    }
});

const indexName = 'my_index';
const localData = JSON.parse(fs.readFileSync('./resources/localData.jsonld', 'utf8'));
const types = ['classes', 'attributes', 'dataTypes'];

async function testConnection() {
    try {
        const info = await elasticClient.info();
        console.log('Connected to Elasticsearch:', info);
    } catch (error) {
        console.error('Connection error:', error);
    }
}

async function checkIndex() {
    try {
        const response = await elasticClient.search({
            index: indexName,
            size: 10000,
            query: {
                match_all: {},
            },
        });

        const elasticsearchDocuments = response.hits.hits.map(hit => hit._source);

        const missingDocuments = [];

        for (const type in types) {
            for (const localDocument of localData[types[type]]) {
                const missingDocument = elasticsearchDocuments.find(doc => doc['@id'] === localDocument['@id']);

                if (!missingDocument) {
                    missingDocuments.push(localDocument);
                }
            }
        }

        console.log(`${missingDocuments.length} documents missing in Elasticsearch.`);

        return missingDocuments;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateIndex(missingDocuments) {
    if (missingDocuments.length > 0) {
        const operations = missingDocuments.flatMap(doc => [
            { index: { _index: indexName, _id: doc['@id'] } },
            doc,
        ]);
        await elasticClient.bulk({ refresh: true, operations });
        console.log(`${missingDocuments.length} documents updated or inserted.`);
    } else {
        console.log('No updates or inserts needed.');
    }
}

app.use(express.static('public'));
app.use(express.json());

app.post('/suggest', async (req, res) => {
    const partialTerm = req.body.partialTerm;
    const searchType = req.body.type;
    const searchLanguage = req.body.language;

    try {
        const query = {
            index: indexName,
            size: 10,
            _source: ['label.@value'],
            sort: [
                { 'label.@value.keyword': { order: 'asc' } }
            ],
            query: {
                bool: {
                    must: [
                        {
                            prefix: {
                                'label.@value': partialTerm
                            }
                        }
                    ]
                }
            }
        };

        if (searchType !== '_all') {
            if (searchType === 'Attributes') {
                query.query.bool.must.push({
                    terms: { '@type.keyword': ['http://www.w3.org/2002/07/owl#DatatypeProperty', 'http://www.w3.org/2002/07/owl#ObjectProperty'] }
                })
            } else {
                query.query.bool.must.push({
                    term: { '@type.keyword': searchType }
                });
            }
        }

        if (searchLanguage !== '_all') {
            query.query.bool.must.push({
                term: { 'label.@language': searchLanguage }
            });
        }

        const response = await elasticClient.search(query);

        const suggestions = response.hits.hits.map(hit => hit._source.label[0]['@value']);
        res.json({ suggestions });
    } catch (error) {
        console.error('Elasticsearch Error:', error);
        res.status(500).json({ error: 'An error occurred while fetching suggestions' });
    }
});

app.post('/search', async (req, res) => {
    const searchTerm = req.body.term;
    const searchType = req.body.type;
    const searchLanguage = req.body.language;

    try {
        const query = {
            index: indexName,
            size: 100,
            sort: [
                { 'label.@value.keyword': { order: 'asc' } },
            ],
            _source: ['label.@value', 'definition.@value', '@type'],
            query: {
                bool: {
                    must: [
                        {
                            multi_match: {
                                query: searchTerm,
                                fields: ['label.@value', 'definition.@value'],
                                fuzziness: 'AUTO'
                            }
                        }
                    ]
                }
            }
        }

        if (searchType !== '_all') {
            if (searchType === 'Attributes') {
                query.query.bool.must.push({
                    terms: { '@type.keyword': ['http://www.w3.org/2002/07/owl#DatatypeProperty', 'http://www.w3.org/2002/07/owl#ObjectProperty'] }
                })
            } else {
                query.query.bool.must.push({
                    term: { '@type.keyword': searchType }
                });
            }
        }

        if (searchLanguage !== '_all') {
            query.query.bool.must.push({
                term: { 'label.@language': searchLanguage }
            });
        }

        const response = await elasticClient.search(query);

        const searchResults = response.hits.hits.map(hit => hit._source);
        res.json({ results: searchResults });
    } catch (error) {
        console.error('Elasticsearch Error:', error);
        res.status(500).json({ error: 'An error occurred while searching' });
    }
});

async function run() {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    var connected = false;
    while (!connected) {
        try {
            await testConnection();
            connected = true;
        } catch (error) {
            console.error('Connection error:', error);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    if (!await elasticClient.indices.exists({ index: indexName })) {
        const response = await elasticClient.indices.create({
            index: indexName,
        });
        console.log('Created index', response);
    }
    const count = await elasticClient.count({ index: indexName });
    console.log(`Index ${indexName} has ${count.count} documents.`);

    var startTime = performance.now()
    const missingDocuments = await checkIndex();
    var endTime = performance.now()
    console.log(`Checking index took ${endTime - startTime} milliseconds.`);

    var startTime = performance.now()
    await updateIndex(missingDocuments);
    var endTime = performance.now()
    console.log(`Indexing took ${endTime - startTime} milliseconds.`);
}

run().catch(console.error);
