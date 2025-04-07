export default class PatternDiagram {
  /**
   * PatternDiagram constructor
   *
   * @param {number} rows
   * @param {number} cols
   * @param {Array} pattern
   *   The pattern should be an array of arrays, where each inner array represents a row
   *   and each element in the inner array represents a column. Elements that have truthy
   *   values are considered part of the pattern.
   */
  constructor(rows, cols, pattern) {
    this.element = document.createElement('div');
    this.element.classList.add('pattern-diagram');
    this.rows = rows;
    this.cols = cols;
    this.pattern = pattern;

    this.render();
  }

  clear() {
    this.element.innerHTML = '';
  }

  render() {
    this.clear();
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    for (let row = 0; row < this.rows; row += 1) {
      const tr = document.createElement('tr');
      for (let col = 0; col < this.cols; col += 1) {
        const td = document.createElement('td');
        tr.appendChild(td);
        if (this.pattern[row] && this.pattern[row][col]) {
          td.classList.add('active');
        }
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.element.appendChild(table);
  }
}
