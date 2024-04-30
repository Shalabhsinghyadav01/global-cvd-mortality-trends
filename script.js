// Set up the SVG dimensions and margins
const width = 960;
const height = 500;
const margin = { top: 20, right: 20, bottom: 20, left: 20 };

// Create the SVG container
const svg = d3.select("#map")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Create a tooltip div
const tooltip = d3.select(".tooltip");

// Define the color scale for the heat map
const colorScale = d3.scaleThreshold()
  .domain([100, 200, 300, 400, 500, 600, 700, 800])
  .range(d3.schemeOrRd[9]);

// Create the line chart SVG
const lineChartSVG = d3.select("#line-chart")
  .attr("width", width)
  .attr("height", 300);

// Create scales and line generator for the line chart
const xScale = d3.scaleLinear().range([100, width - 100]);
const yScale = d3.scaleLinear().range([250, 50]);
const line = d3.line()
  .x(d => xScale(+d.Year))
  .y(d => yScale(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]));

// Create the bubble chart SVG
const bubbleChartSVG = d3.select("#bubble-chart")
  .attr("width", width)
  .attr("height", 400);

// Create scales for the bubble chart
const xScaleBubble = d3.scaleBand().range([100, width - 100]).padding(0.1);
const yScaleBubble = d3.scaleLinear().range([350, 50]);
const radiusScale = d3.scaleLinear().range([10, 50]);
const colorScaleBubble = d3.scaleThreshold()
  .domain([100, 200, 300, 400, 500, 600, 700, 800])
  .range(d3.schemeOrRd[9]);

// Create a tooltip for the bubble chart
const bubbleTooltip = d3.select(".bubble-chart-container")
  .append("div")
  .attr("class", "bubble-tooltip")
  .style("opacity", 0);

// Load the world map data
Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
  d3.csv("cardiovascular-disease-death-rates.csv")
]).then(([mapData, csvData]) => {
  // Get the year slider and value elements
  const yearSlider = d3.select("#year-slider");
  const yearValue = d3.select("#year-value");

  // Set the initial year value
  let currentYear = yearSlider.property("value");
  yearValue.text(currentYear);

  // Create a projection and path generator
  const projection = d3.geoMercator()
    .scale(120)
    .translate([width / 2, height / 1.4]);
  const path = d3.geoPath(projection);

  // Draw the initial map
  updateMap(currentYear);

  // Update the map when the year slider value changes
  yearSlider.on("input", function() {
    currentYear = this.value;
    yearValue.text(currentYear);
    updateMap(currentYear);
  });

  function updateMap(year) {
    // Filter the CSV data for the selected year
    const filteredData = csvData.filter(d => d.Year === year);

    // Convert the filtered data to a dictionary for easy access
    const rateByEntity = {};
    filteredData.forEach(d => {
      rateByEntity[d.Entity] = +d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"];
    });

    // Update the country fill colors, tooltips, and click event
    svg.selectAll("path")
      .data(topojson.feature(mapData, mapData.objects.countries).features)
      .join("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", d => {
        const countryName = d.properties.name;
        const rate = rateByEntity[countryName];
        return rate !== undefined ? colorScale(rate) : "#ccc";
      })
      .on("mouseover", (event, d) => {
        const countryName = d.properties.name;
        const rate = rateByEntity[countryName];
        tooltip.style("opacity", 0.9)
          .html(`${countryName}<br/>Year: ${year}<br/>Rate: ${rate !== undefined ? rate.toFixed(2) : "N/A"}`)
          .style("left", `${event.pageX}px`)
          .style("top", `${event.pageY}px`)
          .style("transform", "translate(-50%, -100%)")
          .style("pointer-events", "none");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      })
      .on("click", (event, d) => {
        const countryName = d.properties.name;
        const countryData = csvData.filter(data => data.Entity === countryName);
        updateLineChart(countryData, countryName);
      });

    // Update the bubble chart
    updateBubbleChart(csvData, year);
  }

  function updateLineChart(data, countryName) {
    // Update the scales' domains
    xScale.domain(d3.extent(data, d => +d.Year));
    yScale.domain([0, d3.max(data, d => +d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"])]);
  
    // Add the line path
    const linePath = lineChartSVG.selectAll(".line")
      .data([data]);
  
    linePath.enter()
      .append("path")
      .attr("class", "line")
      .merge(linePath)
      .attr("d", line);
  
    linePath.exit().remove();
  
    // Add the hover circle and tooltip
    const hoverCircle = lineChartSVG.append("circle")
      .attr("class", "hover-circle")
      .attr("r", 4)
      .attr("fill", "steelblue")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("display", "none");
  
    const hoverTooltip = d3.select(".line-chart-container")
      .append("div")
      .attr("class", "hover-tooltip")
      .style("opacity", 0);
  
    // Add the hover event listeners
    lineChartSVG.append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", height)
      .style("opacity", 0)
      .on("mouseover", () => {
        hoverCircle.style("display", null);
        hoverTooltip.style("opacity", 0.9);
      })
      .on("mouseout", () => {
        hoverCircle.style("display", "none");
        hoverTooltip.style("opacity", 0);
      })
      .on("mousemove", (event) => {
        const x0 = xScale.invert(d3.pointer(event)[0]);
        const bisectYear = d3.bisector(d => +d.Year).left;
        const index = bisectYear(data, x0, 1);
        const d0 = data[index - 1];
        const d1 = data[index];
        const d = x0 - d0.Year > d1.Year - x0 ? d1 : d0;
  
        hoverCircle.attr("transform", `translate(${xScale(+d.Year)}, ${yScale(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"])})`);
  
        hoverTooltip.html(`Year: ${d.Year}<br/>Rate: ${(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]).toFixed(2)}`)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 28}px`);
      });
  
    // Add the x-axis
    const xAxis = lineChartSVG.selectAll(".x-axis")
      .data([data]);
  
    xAxis.enter()
      .append("g")
      .attr("class", "x-axis")
      .merge(xAxis)
      .attr("transform", "translate(0, 250)")
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
  
    xAxis.exit().remove();
  
    // Add the y-axis
    const yAxis = lineChartSVG.selectAll(".y-axis")
      .data([data]);
  
    yAxis.enter()
      .append("g")
      .attr("class", "y-axis")
      .merge(yAxis)
      .attr("transform", "translate(100, 0)")
      .call(d3.axisLeft(yScale));
  
    yAxis.exit().remove();
  
    // Add the x-axis label
    const xAxisLabel = lineChartSVG.selectAll(".x-axis-label")
      .data([data]);
  
    xAxisLabel.enter()
      .append("text")
      .attr("class", "axis-label x-axis-label")
      .merge(xAxisLabel)
      .attr("x", width / 2)
      .attr("y", 290)
      .attr("text-anchor", "middle")
      .text("Year");
  
    xAxisLabel.exit().remove();
  
    // Add the y-axis label
    const yAxisLabel = lineChartSVG.selectAll(".y-axis-label")
      .data([data]);
  
    yAxisLabel.enter()
      .append("text")
      .attr("class", "axis-label y-axis-label")
      .merge(yAxisLabel)
      .attr("x", -150)
      .attr("y", 20)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text("Cardiovascular Disease Death Rate");
  
    yAxisLabel.exit().remove();
  
    // Add grid lines
    const xGrid = lineChartSVG.selectAll(".x-grid")
      .data([data]);
  
    xGrid.enter()
      .append("g")
      .attr("class", "grid x-grid")
      .merge(xGrid)
      .attr("transform", "translate(0, 250)")
      .call(d3.axisBottom(xScale).tickSize(-200).tickFormat(""));
  
    xGrid.exit().remove();
  
    const yGrid = lineChartSVG.selectAll(".y-grid")
      .data([data]);
  
    yGrid.enter()
      .append("g")
      .attr("class", "grid y-grid")
      .merge(yGrid)
      .attr("transform", "translate(100, 0)")
      .call(d3.axisLeft(yScale).tickSize(-width + 200).tickFormat(""));
  
    yGrid.exit().remove();
  
    // Add the country name as the chart title
    const chartTitle = lineChartSVG.selectAll(".chart-title")
      .data([countryName]);
  
    chartTitle.enter()
      .append("text")
      .attr("class", "chart-title")
      .merge(chartTitle)
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .text(countryName);
  
    chartTitle.exit().remove();
  }


  function updateBubbleChart(data, year) {
    // Filter the data for the selected year
    const filteredData = data.filter(d => d.Year === year);

    // Update the scales' domains
    xScaleBubble.domain(filteredData.map(d => d.Entity));
    yScaleBubble.domain([0, d3.max(filteredData, d => +d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"])]);
    radiusScale.domain([0, d3.max(filteredData, d => +d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"])]);

    // Create the bubbles
    const bubbles = bubbleChartSVG.selectAll(".bubble")
      .data(filteredData, d => d.Entity);

    bubbles.enter()
      .append("circle")
      .attr("class", "bubble")
      .attr("cx", d => xScaleBubble(d.Entity))
      .attr("cy", d => yScaleBubble(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]))
      .attr("r", d => radiusScale(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]))
      .attr("fill", d => {
        const rate = +d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"];
        return rate !== undefined ? colorScaleBubble(rate) : "#ccc";
      })
      .attr("opacity", 0.7)
      .on("mouseover", (event, d) => {
        d3.select(event.target)
          .attr("opacity", 1)
          .attr("stroke", "black")
          .attr("stroke-width", 2);
        bubbleTooltip.transition()
          .duration(200)
          .style("opacity", 0.9);
        bubbleTooltip.html(`${d.Entity}<br/>Rate: ${(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]).toFixed(2)}`)
          .style("left", `${event.pageX}px`)
          .style("top", `${event.pageY - 28}px`);
      })
      .on("mouseout", (event, d) => {
        d3.select(event.target)
          .attr("opacity", d.clicked ? 1 : 0.7)
          .attr("stroke", d.clicked ? "black" : null)
          .attr("stroke-width", d.clicked ? 2 : null);
        bubbleTooltip.transition()
          .duration(500)
          .style("opacity", 0);
      })
      .on("click", (event, d) => {
        // Toggle the clicked state of the bubble
        d.clicked = !d.clicked;
        d3.select(event.target)
          .attr("opacity", d.clicked ? 1 : 0.7)
          .attr("stroke", d.clicked ? "black" : null)
          .attr("stroke-width", d.clicked ? 2 : null);
        // Update the bubble label visibility based on the clicked state
        const bubbleLabel = bubbleChartSVG.selectAll(".bubble-label")
          .filter(labelData => labelData.Entity === d.Entity);
        bubbleLabel.attr("visibility", d.clicked ? "visible" : "hidden");
      })
      .merge(bubbles)
      .transition()
      .duration(500)
      .attr("cx", d => xScaleBubble(d.Entity))
      .attr("cy", d => yScaleBubble(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]))
      .attr("r", d => radiusScale(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]));

    bubbles.exit().remove();

    // Create the bubble labels
    const bubbleLabels = bubbleChartSVG.selectAll(".bubble-label")
      .data(filteredData, d => d.Entity);

    bubbleLabels.enter()
      .append("text")
      .attr("class", "bubble-label")
      .attr("x", d => xScaleBubble(d.Entity))
      .attr("y", d => yScaleBubble(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]) - radiusScale(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]) - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "black")
      .attr("visibility", "hidden")
      .text(d => `${d.Entity}: ${(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]).toFixed(2)}`)
      .merge(bubbleLabels)
      .transition()
      .duration(500)
      .attr("x", d => xScaleBubble(d.Entity))
      .attr("y", d => yScaleBubble(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]) - radiusScale(+d["Deaths - Cardiovascular diseases - Sex: Both - Age: Age-standardized (Rate)"]) - 10);

    bubbleLabels.exit().remove();

    // Add x-axis label
    bubbleChartSVG.append("text")
      .attr("class", "bubble-axis-label")
      .attr("x", width / 2)
      .attr("y", 390)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .text("Country");

    // Add y-axis label
    bubbleChartSVG.append("text")
      .attr("class", "bubble-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -200)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .text("Cardiovascular Disease Death Rate");
  }

  // Add legend
  const legendWidth = 200;
  const legendHeight = 20;
  const legendScale = d3.scaleLinear()
    .domain([0, 800])
    .range([0, legendWidth]);

  const legendAxis = d3.axisBottom(legendScale)
    .tickSize(10)
    .tickValues(colorScale.domain())
    .tickFormat(d => d);

  const legend = d3.select(".legend-scale")
    .append("svg")
    .attr("width", legendWidth)
    .attr("height", legendHeight);

  legend.selectAll("rect")
    .data(colorScale.range())
    .enter()
    .append("rect")
    .attr("x", (d, i) => i * legendWidth / colorScale.range().length)
    .attr("width", legendWidth / colorScale.range().length)
    .attr("height", legendHeight)
    .attr("fill", d => d);

  legend.append("g")
    .attr("transform", `translate(0, ${legendHeight})`)
    .call(legendAxis);
});