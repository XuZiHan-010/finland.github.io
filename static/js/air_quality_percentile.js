(function () {
    const map = L.map('map').setView([64.5, 26.0], 6); // Finland-centered map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: 'Map tiles by Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
    }).addTo(map);

    const urls = {
        geojson: '../data/geojson_file.geojson', // Replace with your GeoJSON path
        deviation: '../data/data_cleaned.json', // Replace with your deviation data path
    };

    let geojsonLayer;
    let currentMonth = '2023-05'; // Default to May 2023
    let currentCategory = '101'; // Default to the first category
    const timeLabels = generateTimeLabels('2023-05', '2024-04');
    const chartElement = document.getElementById('areaChart');
    const ctx = chartElement.getContext('2d');
    let chartDataSets = [];
    window.myLineChart = null; // Chart instance

    // Generate time labels for months
    function generateTimeLabels(start, end) {
        const labels = [];
        let currentDate = new Date(start + '-01');
        const endDate = new Date(end + '-01');
        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
            labels.push(`${year}-${month}`);
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        return labels;
    }

    async function validateData(url, isGeoJson = false) {
        const data = await loadData(url);

        if (isGeoJson) {
            data.features.forEach((feature) => {
                if (feature.properties.GID_3) {
                    feature.properties.GID_3 = String(feature.properties.GID_3);
                }
            });
            return data;
        } else {
            data.forEach((item) => {
                item.GID_3 = String(item.GID_3);
                if (item.categories[currentCategory]) {
                    Object.keys(item.categories[currentCategory]).forEach((key) => {
                        item.categories[currentCategory][key] = isNaN(parseFloat(item.categories[currentCategory][key]))
                            ? -1
                            : parseFloat(item.categories[currentCategory][key]);
                    });
                }
            });
            return data;
        }
    }

    function initializeChart(dataSets) {
        if (window.myLineChart) {
            window.myLineChart.destroy(); // Destroy existing chart instance
        }

        window.myLineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeLabels, // Use generated monthly labels
                datasets: dataSets,
            },
            options: {
                responsive: true,
                title: {
                    display: true,
                    text: `${currentCategory} Deviation Chart`,
                    fontSize: 22,
                    fontColor: '#000',
                    padding: 0,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });

        updateChartVisibility();
    }

    function updateChartVisibility() {
        const canvasBackground = document.getElementById('canvasBackground');
        if (chartDataSets.length > 0) {
            canvasBackground.style.display = 'block';
        } else {
            canvasBackground.style.display = 'none';
        }
    }

    async function loadData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Failed to load data:', error.message);
            throw error;
        }
    }

    function getColor(deviation) {
        return deviation > 40
            ? '#BD0026'
            : deviation > 36
            ? '#F03B20'
            : deviation > 12
            ? '#FD8D3C'
            : deviation > 10
            ? '#FECC5C'
            : '#FFFFB2';
    }

    async function updateMap() {
        const deviationData = await validateData(urls.deviation);
        const geoJsonData = await validateData(urls.geojson, true);

        console.log('Deviation Data:', deviationData);
        console.log('GeoJSON Data:', geoJsonData);

        if (geojsonLayer) map.removeLayer(geojsonLayer);

        geojsonLayer = L.geoJson(geoJsonData, {
            style: function (feature) {
                const areaData = deviationData.find((d) => d.GID_3 === feature.properties.GID_3);

                if (areaData && areaData.categories[currentCategory] && areaData.categories[currentCategory][currentMonth] !== undefined) {
                    const color = getColor(areaData.categories[currentCategory][currentMonth]);
                    return {
                        fillColor: color,
                        weight: 2,
                        opacity: 1,
                        color: 'white',
                        fillOpacity: 0.7,
                    };
                } else {
                    return {
                        fillColor: '#ccc',
                        weight: 2,
                        opacity: 1,
                        color: 'white',
                        fillOpacity: 0.5,
                    };
                }
            },
            onEachFeature: function (feature, layer) {
                layer.on('click', function () {
                    updateChartData(feature.properties.GID_3, deviationData);
                });
            },
        }).addTo(map);

        updateLegend(); // Update the legend when the map is updated
    }

    async function updateChartData(areaName, deviationData) {
        const areaData = deviationData.find((d) => d.GID_3 === areaName);

        if (!areaData) {
            chartDataSets = [];
            updateChartVisibility();
            return;
        }

        const deviationValues = timeLabels.map((label) => areaData.categories[currentCategory][label] || -1);
        const datasetLabel = `${areaName} ${currentCategory} Deviation`;

        let dataset = chartDataSets.find((dataset) => dataset.label === datasetLabel);

        if (!dataset) {
            dataset = {
                label: datasetLabel,
                data: deviationValues,
                backgroundColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.2)`,
                borderColor: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 1)`,
                borderWidth: 1,
            };
            chartDataSets.push(dataset);
        } else {
            dataset.data = deviationValues;
        }

        initializeChart(chartDataSets);
    }

    function updateLegend() {
        const legendTitle = document.getElementById('legendTitle');
        legendTitle.innerHTML = `Color Legend (Deviation  ${currentMonth})`; // Update the legend title with the current month

        const legendContent = document.getElementById('legendContent');
        legendContent.innerHTML = ''; // Clear existing content

        const categories = [
            { color: '#BD0026', label: '> 40' },
            { color: '#F03B20', label: '36 - 40' },
            { color: '#FD8D3C', label: '12 - 36' },
            { color: '#FECC5C', label: '10 - 12' },
            { color: '#FFFFB2', label: '0 - 10' },
            { color: '#ccc', label: 'no data' },
        ];

        categories.forEach((cat) => {
            const legendItem = document.createElement('div');
            legendItem.innerHTML = `<i style="background:${cat.color}; width: 20px; height: 20px; display: inline-block; margin-right: 10px;"></i>${cat.label}`;
            legendContent.appendChild(legendItem);
        });
    }

    document.querySelectorAll('[data-month]').forEach((button) => {
        button.addEventListener('click', function () {
            currentMonth = this.getAttribute('data-month');
            updateMap();
        });
    });

    document.getElementById('categorySelect').addEventListener('change', function () {
        currentCategory = this.value;
        updateMap();
    });

    document.getElementById('clearChartBtn').addEventListener('click', function () {
        chartDataSets = [];
        updateChartVisibility();
        if (window.myLineChart) {
            window.myLineChart.data.datasets = chartDataSets;
            window.myLineChart.update();
        }
    });

    updateMap();
})();
