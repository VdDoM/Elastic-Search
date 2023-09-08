const searchInput = document.getElementById('searchInput');
const searchType = document.getElementById('searchType');
const searchLanguage = document.getElementById('searchLanguage');
const suggestionsList = document.getElementById('suggestions');
const resultsList = document.getElementById('resultsList');

async function search() {
    const searchTerm = searchInput.value;

    const response = await fetch('/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ term: searchTerm, type: searchType.value, language: searchLanguage.value })
    });

    const data = await response.json();

    resultsList.innerHTML = ''; // Clear previous results

    data.results.forEach(result => {
        const li = document.createElement('li');
        li.classList.add('result-item'); // Add a class for styling purposes

        const title = document.createElement('h3');
        title.textContent = result.label[0]['@value']; // Main title
        li.appendChild(title);

        const niveau = document.createElement('p');
        niveau.classList.add('niveau'); // Add a class for styling purposes
        niveau.textContent = result['@type']; // Niveau text
        li.appendChild(niveau);

        const description = document.createElement('p');
        description.classList.add('definition'); // Add a class for styling purposes
        description.textContent = result.definition[0]['@value']; // Description text
        li.appendChild(description);

        resultsList.appendChild(li);
    });
}

async function autoComplete() {
    const partialTerm = searchInput.value;

    const suggestResponse = await fetch('/suggest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ partialTerm, type: searchType.value, language: searchLanguage.value })
    });

    const suggestData = await suggestResponse.json();
    const suggestions = suggestData.suggestions;

    suggestionsList.innerHTML = ''; // Clear previous suggestions

    suggestions.forEach(suggestion => {
        const option = document.createElement('option');
        // check if suggestion is already in the list and if the suggestion is not the same as the current input
        if (!suggestionsList.innerHTML.includes(suggestion.toLowerCase()) && suggestion.toLowerCase() !== partialTerm.toLowerCase()) {
            option.value = suggestion.toLowerCase();
            suggestionsList.appendChild(option);
        }
    });

    // Highlight current input text with grey suggestions
    const highlightedText = `<span class="highlight">${partialTerm}</span>`;
}

searchType.addEventListener('change', () => { autoComplete(); search(); });
searchLanguage.addEventListener('change', () => { autoComplete(); search(); });
searchInput.addEventListener('input', async () => { autoComplete(); search(); });
