const fs = require('fs');
const express = require('express');
const { Client } = require('@elastic/elasticsearch');
const app = express();
const PORT = 3000;

// Create an Elasticsearch client
const elasticClient = new Client({
    cloud: { id: 'cloud_id' },
    auth: { apiKey: 'API_key' }
});

const indexName = 'my_index';

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
        const localData = JSON.parse(fs.readFileSync('localData.json', 'utf8'));

        const scrollResponse = await elasticClient.search({
            index: indexName,
            scroll: '30s',
            size: 1000,
            body: {
                query: {
                    match_all: {},
                },
            },
        });

        let elasticsearchDocuments = scrollResponse.hits.hits.map(hit => hit._source);

        const elasticsearchLabels = new Set(elasticsearchDocuments.map(doc => doc.label));

        const missingDocuments = [];

        await Promise.all(localData.map(async localDoc => {
            if (!elasticsearchLabels.has(localDoc.label)) {
                missingDocuments.push(localDoc);
            }
        }));

        // Clear the scroll
        await elasticClient.clearScroll({ scroll_id: scrollResponse._scroll_id });
        
        return missingDocuments;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateIndex(missingDocuments) {
    if (missingDocuments.length > 0) {
        const operations = missingDocuments.flatMap(doc => [
            { index: { _index: indexName } },
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

    try {
        const response = await elasticClient.search({
            index: indexName,
            size: 10,
            body: {
                query: {
                    prefix: {
                        prefLabel: partialTerm
                    }
                }
            }
        });

        const suggestions = response.hits.hits.map(hit => hit._source.prefLabel);
        res.json({ suggestions });
    } catch (error) {
        console.error('Elasticsearch Error:', error);
        res.status(500).json({ error: 'An error occurred while fetching suggestions' });
    }
});

app.post('/search', async (req, res) => {
    const searchTerm = req.body.term;

    try {
        const response = await elasticClient.search({
            index: indexName,
            size: 100,
            body: {
                query: {
                    multi_match: {
                        query: searchTerm,
                        fields: ['prefLabel', 'definition'],
                        fuzziness: 'AUTO'
                    }
                }
            }
        });

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

    await testConnection();
    if (!await elasticClient.indices.exists({ index: indexName })) {
        await elasticClient.indices.create({
            index: indexName,
        });
    }
    const missingDocuments = await checkIndex();
    await updateIndex(missingDocuments);
}

run().catch(console.error);
