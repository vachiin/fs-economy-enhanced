// ==UserScript==
// @name        FS Economy Enhancement
// @author      Niels Huylebroeck + vachiin
// @namespace   nightwalkers
// @description Improvements for FS Economy usability
// @include     http://server.fseconomy.net/*
// @include     http://server.fseconomy.net:81/*
// @include     http://www.fseconomy.net:81/*
// @include     http://server.fseconomy.org/*
// @include     https://server.fseconomy.net/*
// @version     12
// @grant       none
// @update      https://greasyfork.org/scripts/7054-fs-economy-enhancement/code/FS%20Economy%20Enhancement.user.js
// ==/UserScript==

const LOG_ENABLED = false;
const MAN_WEIGHT = 77;
const rounding = 2;

function check_table_valid(table) {
    if (table.rows.length === 0) return false;
    if (table.classList.contains('assigmentTable') || table.classList.contains('assignmentTable')) {
        return true;
    }
}

function getColNumber(table, colName) {
    for (let y = 0; table.rows[0].cells.length; y++) {
        let cell = table.rows[0].cells[y];
        if (cell.textContent.indexOf(colName) === 0) {
            // console.info(colName + ' is in column idx' + y);
            return y;
        }
    }
    console.error('Unable to find column header:', colName);
    return undefined;
}

function addColumnHeader(table, headerName) {
    const col_head = document.createElement('th');
    col_head.setAttribute('class', 'tablesorter-header sorter-false');
    col_head.textContent = headerName;
    table.rows[0].appendChild(col_head);
}

function addCell(row, content, spanRows, bgColor) {
    // console.log('addCell', content);
    let new_cell = document.createElement('td');
    new_cell.textContent = content;
    new_cell.setAttribute('class', 'numeric');
    if (spanRows) {
        new_cell.setAttribute('rowspan', spanRows);
        if (bgColor) {
            new_cell.setAttribute("style", "background-color: " + bgColor)
        }
    }
    row.appendChild(new_cell);
}

function extractQuantity(row, col_cargo) {
    if (row.cells[col_cargo].textContent.search(/kg/) !== -1) {
        return row.cells[col_cargo].textContent.match(/(\d+)kg/)[1];
    }
    if (row.cells[col_cargo].textContent.search(/(\d+) .*/) !== -1) {
        return row.cells[col_cargo].textContent.match(/(\d+) .*/)[1];
    }
    return undefined;
}

function extractCargo(row, col_cargo) {
    return row.cells[col_cargo].textContent.search(/kg/) !== -1;
}

function getPrice(text) {
    return parseFloat(text.replace('$', '').replace(',', ''));
}

function calculatePerMan(table, col_cargo, col_nm, col_pay) {
    addColumnHeader(table, 'Price per nm/qty');

    for (let x = 1; x < table.rows.length; x++) {
        let row = table.rows[x];
        let qtyS = 1, range, price, cargo = false, calculation = 0;
        try {
            qtyS = extractQuantity(row, col_cargo);
            cargo = extractCargo(row, col_cargo, x);
        } catch (e) {
            console.log(e, row.cells[col_cargo.textContent]);
        }
        let qty = parseFloat(qtyS || "1");
        if (cargo) {
            // 77 Kg per person
            qty = Math.ceil(qty / MAN_WEIGHT);
            row.cells[col_cargo].textContent += ' (' + qty + ' passengers)';
        }
        range = parseFloat(row.cells[col_nm].textContent);
        price = getPrice(row.cells[col_pay].textContent);

        // if (LOG_ENABLED) console.info('cargo ', cargo, 'qtyS', qtyS, 'qty', qty, 'range', range, 'price', price);

        if (qty && range && price) {
            calculation = (Math.round((price / qty / range) * Math.pow(10, rounding)) / Math.pow(10, rounding)).toFixed(2);
        } else {
            calculation = NaN;
        }
        addCell(row, '$' + calculation.toString());
    }
}

function sortByColumn(nrCol) {
    $('table[class^="ass"] [data-column="' + nrCol + '"]').first().trigger('sort');
}

function findNotEmptyAssignmentsTable() {
    const tables = document.getElementsByTagName('table');
    const tbls = [];
    for (let table of tables) {
        if (!check_table_valid(table)) continue;
        tbls.push(table);
    }
    return tbls;
}

function calculatePerDestinationSum(table, col_dest, col_pay, col_nm) {
    let groups = {};

    addColumnHeader(table, 'Sum price per destination');
    let maxPerRange = 0;
    for (let x = 1; x < table.rows.length; x++) {
        let row = table.rows[x];
        let aiport = row.cells[col_dest].textContent.trim();
        let price = getPrice(row.cells[col_pay].textContent.trim());
        let range = parseFloat(row.cells[col_nm].textContent.trim());

        let data = groups[aiport];
        if (data === undefined) {
            data = {sum: price, count: 1};
        } else {
            data = {sum: data.sum + price, count: data.count + 1};
        }
        data.perRange = (Math.round((data.sum / range) * Math.pow(10, rounding)) / Math.pow(10, rounding)).toFixed(2);
        groups[aiport] = data;

        if (Number(data.perRange) > Number(maxPerRange)) {
            maxPerRange = data.perRange;
        }
    }

    let prevAiport = '';
    for (let x = 1; x < table.rows.length; x++) {
        let row = table.rows[x];
        let aiport = row.cells[col_dest].textContent.trim();
        if (prevAiport !== aiport) {
            let data = groups[aiport];
            let message = '$' + data.sum + ' from ' + data.count + ' assignments (per NM = $' + data.perRange + ')';
            let bgColor = (maxPerRange === data.perRange) ? '#efffef' : '#dfdfdf';
            addCell(row, message, data.count, bgColor);
        }
        prevAiport = aiport;
    }

    // if (LOG_ENABLED) console.log(groups);
}

function main() {
    for (let table of findNotEmptyAssignmentsTable()) {
        let col_pay = getColNumber(table, 'Pay');
        let col_nm = getColNumber(table, 'NM');
        let col_dest = getColNumber(table, 'Dest');
        let col_cargo = getColNumber(table, 'Cargo');

        if (col_pay === undefined || col_nm === undefined || col_cargo === undefined || col_dest === undefined) {
            throw 'fatal error'
        }

        calculatePerMan(table, col_cargo, col_nm, col_pay);
        sortByColumn(col_nm);

        const waitjQuery = setInterval(function () {
            if ($("th.tablesorter-headerAsc:contains('NM')").length === 1) {
                clearInterval(waitjQuery);
                calculatePerDestinationSum(table, col_dest, col_pay, col_nm);
                $(".assignmentTable").tablesorter();
            }
        }, 1000);
    }
}

$(document).ready(
    main()
);

