const searchInput = document.getElementById('searchInput');
const suggestionsList = document.getElementById('suggestions');
const resultsList = document.getElementById('resultsList');

searchInput.addEventListener('input', async () => {
    const partialTerm = searchInput.value;

    const suggestResponse = await fetch('/suggest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ partialTerm })
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
});

// Handle search form submission
searchInput.addEventListener('input', async () => {
    const searchTerm = searchInput.value;

    const response = await fetch('/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ term: searchTerm })
    });

    const data = await response.json();

    resultsList.innerHTML = ''; // Clear previous results

    data.results.forEach(result => {
        const li = document.createElement('li');
        li.classList.add('result-item'); // Add a class for styling purposes

        const title = document.createElement('h3');
        title.textContent = result.prefLabel; // Main title
        li.appendChild(title);

        const description = document.createElement('p');
        description.classList.add('description'); // Add a class for styling purposes
        description.textContent = result.definition; // Description text
        li.appendChild(description);

        resultsList.appendChild(li);
    });
});

searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        searchInput.blur(); // Blur the input field to exit
        event.preventDefault(); // Prevent the default Enter key behavior
    }
});
