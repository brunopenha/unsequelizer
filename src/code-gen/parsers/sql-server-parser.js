'use strict';

const changeCase = require('change-case')
const multiMatch = require('../utils').multiMatch
const classes = require('../classes')

const Table = classes.Table
const TableColumn = classes.TableColumn
const TableConstraint = classes.TableConstraint
const Table2Class = classes.Table2Class

module.exports = function parse(data) {

    const SQL_DATA_TYPES = 'CHAR|CHARACTER|VARCHAR|NVARCHAR|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|BINARY|VARBINARY|BIT|TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|DEC|NUMERIC|FIXED|FLOAT|DOUBLE|DOUBLE[^w|;]+PRECISION|REAL|BOOL|BOOLEAN|DATE|DATETIME|DATETIME2|UNIQUEIDENTIFIER|UUID|GUID|TIMESTAMP|TIME|YEAR|TINYBLOB|BLOB|MEDIUMBLOB|FILESTREAM|NUMERIC|LONGTEXT|MONEY|CURRENCY|NCHAR|NTEXT|SQL_VARIANT|TABLE|CURSOR';

    const REGEX_CREATE_TABLE = /\bCREATE\W+TABLE[^;]+/gim
    const REGEX_TABLE_SCHEMA_NAME = /\bCREATE\W+TABLE.+?(?:(\w+)\W*\.\W*)?(\w+)\W*\(/gim
    const REGEX_TABLE_CONTENT = /\bCREATE\W+TABLE[^(]+\(([\s\S]+)\)/gim

  //  const REGEX_NOT_COLUMN = /^\W*(?:PRIMARY\W+KEY|CONSTRAINT)[^,]+,?/gim

    const REGEX_TABLE_COLUMN = new RegExp('(?:\\W*(\\w+)\\W+(' + SQL_DATA_TYPES + ')(?:\\W*\\([^)]+\\))?([\\s\\S]+))', 'gim') // [name, type, properties]

    const REGEX_CONSTRAINT_REFERENCE =
        /\bCONSTRAINT[^,)]+(PRIMARY|FOREIGN)\W+KEY\W*\(([^)]+)\)(?:\W+REFERENCES\W+(?:(\w+)\W*\.\W*)?(\w+))?/gim; // [type, keys, schema, referenced table]


    const tables = []

    multiMatch(data.replace(/(?:\r?\n|\s)+/gim, ' '), REGEX_CREATE_TABLE, table => {

        REGEX_TABLE_SCHEMA_NAME.lastIndex = 0
        const titleMatch = REGEX_TABLE_SCHEMA_NAME.exec(table)
        const tableSchema = changeCase.snakeCase(titleMatch[1])
        const tableName = changeCase.snakeCase(titleMatch[2])

        multiMatch(table, REGEX_TABLE_CONTENT, (match, content) => {

            const tableDTO = new Table(tableSchema, tableName);

            content.split(/,(?![^(]*\))/m).forEach(commandLine => {

                // console.log(commandLine)
                REGEX_CONSTRAINT_REFERENCE.lastIndex = 0
                if (REGEX_CONSTRAINT_REFERENCE.test(commandLine)) {

                        multiMatch(commandLine, REGEX_CONSTRAINT_REFERENCE, (declaration, type, keys, referencedSchema, referencedTable) => {
// console.log(declaration)
                            tableDTO.constraints.push(new TableConstraint(changeCase.upperCase(type), keys.split(',').map(key => changeCase.snakeCase(key)), changeCase.snakeCase(referencedSchema), changeCase.snakeCase(referencedTable)))
                        })

                } else {

                    multiMatch(commandLine, REGEX_TABLE_COLUMN, (column, name, type, properties) => {
                      //console.log(type)
                          tableDTO.columns.push(new TableColumn(changeCase.snakeCase(name), changeCase.upperCase(type), changeCase.upperCase(properties)))
                    })
                }
                if (tableName === 'bank_account_kind') console.log(commandLine)
            })

            tables.push(tableDTO);
        })
    })

    return tables;
}
