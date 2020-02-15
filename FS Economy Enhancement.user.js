// ==UserScript==
// @name        FS Economy Enhancement
// @author      Niels Huylebroeck
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

const LOG_ENABLED = true;
const MAN_WEIGHT = 77;

function check_table_valid(table) {
    if (table.rows.length === 0) return false;
    if (table.classList.contains('assigmentTable') || table.classList.contains('assignmentTable') || table.classList.contains('holdTable')) {
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
    col_head.textContent = headerName;
    table.rows[0].appendChild(col_head);
}

function addCell(row, content) {
    // console.log('addCell', content);
    let new_cell = document.createElement('td');
    new_cell.textContent = '$' + content.toString();
    new_cell.setAttribute('class', 'numeric');
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

function calculate(table, col_cargo, col_nm, col_pay) {
    for (let x = 1; x < table.rows.length; x++) {
        let row = table.rows[x];
        let qtyS = 1, range, price, cargo = false, calculation = 0, rounding = 2;
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
        price = parseFloat(row.cells[col_pay].textContent.replace('$', '').replace(',', ''));

        if (LOG_ENABLED) console.info('cargo ', cargo, 'qtyS', qtyS, 'qty', qty, 'range', range, 'price', price);

        if (qty && range && price) {
            while (calculation === 0) {
                calculation = Math.round((price / qty / range) * Math.pow(10, rounding)) / Math.pow(10, rounding);
                rounding++;
            }
        } else {
            calculation = NaN;
        }
        addCell(row, calculation);
    }
}

function main() {
    const tables = document.getElementsByTagName('table');
    for (let table of tables) {
        if (!check_table_valid(table)) continue;

        addColumnHeader(table, 'Price per nm/qty');

        let col_pay = getColNumber(table, 'Pay');
        let col_nm = getColNumber(table, 'NM');
        let col_cargo = getColNumber(table, 'Cargo');

        if (col_pay === undefined || col_nm === undefined || col_cargo === undefined) {
            continue;
        }
        calculate(table, col_cargo, col_nm, col_pay);

        if (typeof jQuery !== 'undefined') {
            jQuery(table).trigger('updateAll');
        }
    }
}

main();
