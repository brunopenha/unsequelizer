'use strict';

const changeCase = require('change-case')
const multiMatch = require('../utils').multiMatch
const Table = require('../classes/Table')
const TableColumn = require('../classes/TableColumn')
const TableConstraint = require('../classes/TableConstraint')
const ForeignKey = require('../classes/ForeignKey')

module.exports = function parse(data) {

    const SQL_DATA_TYPES =
        'CHAR|CHARACTER|VARCHAR|NVARCHAR|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|BINARY|' +
        'VARBINARY|BIT|TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|DEC|' +
        'NUMERIC|FIXED|FLOAT|DOUBLE|DOUBLE[^w|;]+PRECISION|REAL|BOOL|BOOLEAN|DATE|' +
        'DATETIME|DATETIME2|UNIQUEIDENTIFIER|UUID|GUID|TIMESTAMP|TIME|YEAR|TINYBLOB|' +
        'BLOB|MEDIUMBLOB|FILESTREAM|NUMERIC|LONGTEXT|MONEY|CURRENCY|NCHAR|NTEXT|' +
        'SQL_VARIANT|TABLE|CURSOR'

    const REGEX_CREATE_TABLE = /\bCREATE\W+TABLE[^;]+/gim
    const REGEX_TABLE_SCHEMA_NAME = /\bCREATE\W+TABLE.+?(?:(\w+)\W*\.\W*)?(\w+)\W*\(/gim
    const REGEX_TABLE_CONTENT = /\bCREATE\W+TABLE[^(]+\(([\s\S]+)\)/gim

    const REGEX_TABLE_COLUMN =
        new RegExp('(?:\\W*(\\w+)\\W+(' + SQL_DATA_TYPES + ')(?:\\W*\\([^)]+\\))?([\\s\\S]+))', 'gim') // [name, type, properties]

    const REGEX_CONSTRAINT_REFERENCE =
        /\bCONSTRAINT[^,)]+(PRIMARY|FOREIGN)\W+KEY\W*\(([^)]+)\)(?:\W+REFERENCES\W+(?:(\w+)\W*\.\W*)?(\w+)\W+\(([^)]+)\))?/gim; // [type, keys, schema, referenced table, referenced columns]

    const tables = []

    multiMatch(data.replace(/(?:\r?\n|\s)+/gim, ' '), REGEX_CREATE_TABLE, table => {

        REGEX_TABLE_SCHEMA_NAME.lastIndex = 0 // RESET INTERNAL INDEX
        const titleMatch = REGEX_TABLE_SCHEMA_NAME.exec(table)
        const tableSchema = changeCase.snakeCase(titleMatch[1])
        const tableName = changeCase.snakeCase(titleMatch[2])

        const tableDTO = new Table(tableSchema, tableName);

        multiMatch(table, REGEX_TABLE_CONTENT, (match, content) => {

            content.split(/,(?![^(]*\))/m).forEach(commandLine => {

                REGEX_CONSTRAINT_REFERENCE.lastIndex = 0 // RESET INTERNAL INDEX

                if (REGEX_CONSTRAINT_REFERENCE.test(commandLine)) {

                    multiMatch(commandLine, REGEX_CONSTRAINT_REFERENCE, (declaration, type, keys, foreignSchema, foreignTable, foreignColumns) => {
                        tableDTO.constraints.push(
                            new TableConstraint(
                                changeCase.snakeCase(type),
                                keys.split(',').map(key => changeCase.snakeCase(key)),
                                changeCase.snakeCase(foreignSchema),
                                changeCase.snakeCase(foreignTable),
                                foreignColumns ? foreignColumns.split(',').map(col => changeCase.snakeCase(col)) : null
                            )
                        )
                    })

                } else {

                    multiMatch(commandLine, REGEX_TABLE_COLUMN, (column, name, type, properties) => {
                        tableDTO.columns.push(
                            new TableColumn(
                                changeCase.snakeCase(name),
                                changeCase.snakeCase(type),
                                properties.match(/\bNOT\W+NULL\b/im),
                                properties.match(/\bPRIMARY\W+KEY\b/im)
                            )
                        )
                    })
                }
            })
        })
        tables.push(tableDTO);
    })

    // RESOLVE FOREIGN KEYS REFERENCES
    tables.forEach(table =>
        table.columns.forEach(column =>
            table.constraints.forEach(constraint => {

                switch (constraint.type.toUpperCase()) {
                    case 'PRIMARY':
                        if (!column.isPrimaryKey) column.isPrimaryKey = constraint.keys.some(key => key === column.name)
                        break
                    case 'FOREIGN':
                        if (column.foreignKey) return new Error(`A ${table.name}.${column.name} IS REFERENCED BY 2 FOREIGN KEYS`)
                        column.foreignKey = new ForeignKey(constraint.foreignTable, constraint.foreignColumn)
                        break
                    default:
                        return console.debug(`IGNORING CONSTRAINT WITH TYPE ${constraint.type}`)
                }
            })
        )
    )
    return tables;
}
