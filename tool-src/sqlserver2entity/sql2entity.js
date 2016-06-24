const fs = require('fs')
const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')



const DIST_FOLDER_PATH = 'dist-entities/'


// PROCESS -------------------------------------------

function parseTables(data) {

    const SQL_DATA_TYPES = 'CHAR|VARCHAR|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|BINARY|VARBINARY|BIT|TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|DEC|NUMERIC|FIXED|FLOAT|DOUBLE|DOUBLE[^w|;]+PRECISION|REAL|BOOL|BOOLEAN|DATE|DATETIME|DATETIME2|UNIQUEIDENTIFIER|UUID|GUID|TIMESTAMP|TIME|YEAR|TINYBLOB|BLOB|MEDIUMBLOB|FILESTREAM|NUMERIC|LONGTEXT|MONEY|CURRENCY|NCHAR|NTEXT|SQL_VARIANT|TABLE|CURSOR';

    const REGEX_CREATE_TABLE = /\bCREATE\W+TABLE[^;]+/gim
    const REGEX_TABLE_SCHEMA_NAME = /\bCREATE\W+TABLE.+?(?:(\w+)\W*\.\W*)?(\w+)\W*\(/gim
    const REGEX_TABLE_CONTENT = /\bCREATE\W+TABLE[^(]+\(([\s\S]+)\)/gim

    const REGEX_NOT_COLUMN = /^\W*(?:PRIMARY\W+KEY|CONSTRAINT)[^,]+,?/gim

    const REGEX_TABLE_COLUMN = new RegExp('(?:\\W*(\\w+)\\W+(' + SQL_DATA_TYPES + ')(?:\\W*\\([^)]+\\))?([\\s\\S]+))', 'gim') // [name, type, properties]

    const REGEX_CONSTRAINT_REFERENCE =
        /\W*CONSTRAINT[^,)]+(PRIMARY|FOREIGN)\W+KEY\W*\(([^)]+)\)(?:\W+REFERENCES\W+(?:(\w+)\W*\.\W*)?(\w+))?/gim; // [type, keys, schema, referenced table]


    const tables = []

    multiMatch(data.replace(/(?:\r?\n|\s)+/gim, ' ').replace(), REGEX_CREATE_TABLE, table => {

        REGEX_TABLE_SCHEMA_NAME.lastIndex = 0
        const titleMatch = REGEX_TABLE_SCHEMA_NAME.exec(table)
        const tableSchema = titleMatch[1]
        const tableName = titleMatch[2]

        multiMatch(table, REGEX_TABLE_CONTENT, (match, content) => {

            const tableDTO = new Table(tableSchema, tableName);

            content.split(',').forEach(commandLine => {

                //console.log(command)

                if (REGEX_NOT_COLUMN.test(commandLine)) {

                    if (REGEX_CONSTRAINT_REFERENCE.test(commandLine)) {

                        multiMatch(commandLine, REGEX_CONSTRAINT_REFERENCE, (declaration, type, keys, referencedSchema, referencedTable) => {

                            tableDTO.constraints.push(new TableConstraint(type, keys.split(','), referencedSchema, referencedTable))
                        })
                    }
                } else {

                    multiMatch(commandLine, REGEX_TABLE_COLUMN, (column, name, type, properties) => {

                          tableDTO.columns.push(new TableColumn(name, type, properties))
                    })
                }
            })

            tables.push(tableDTO);
        })
    })

    return tables;
}


function generateEntitiesFiles(parsed) {
    const classes = [];

    if (parsed) parsed.forEach(table => {
        //console.log(table)
        const map = new Table2Map(table);
        classes.push(new Class(map.className, cliNamespace, map.fields, map.base));
    })

    for (let languageName in BUILTIN_LANGUAGE_DEFINITIONS) {
        const language = BUILTIN_LANGUAGE_DEFINITIONS[languageName]
        const languageOutputFolder = DIST_FOLDER_PATH + language.folderName;

        rimraf(languageOutputFolder, ['rmdir'], err => {

            if (err) return console.log(err)

            mkdirp(languageOutputFolder, (err) => {
                if (err) return console.error(err)

                fs.readFile('templates/' + language.folderName + '-template.hbs', 'utf8', (err, template) => {
                    if (err) {
                        return console.log(err)
                    }

                    const languageWriter = Handlebars.compile(template)

                    classes.forEach(classDefinition => {
                        const languageClass = classDefinition.buildForLanguage(language)
                        const file = new File(DIST_FOLDER_PATH + language.folderName + '/', languageClass.className + language.fileExtension, languageWriter(languageClass))

                        fs.writeFile(file.path + file.name, file.content, err => {
                            if (err) {
                                return console.log(file.path, err);
                            }
                            console.log('\tWrote', language.name, file.path + file.name)
                        });
                    })
                })
            })
        })
    }
}



// CLASSES --------------------------------------------

class LanguageDefinitions {
    constructor(name, folderName, defaultNamespace, fileExtension, dictionary) {
        this.name = name
        this.folderName = folderName
        this.defaultNamespace = defaultNamespace
        this.fileExtension = fileExtension
        this.dictionary = dictionary
    }
}

class File {
    constructor(path, name, content, language) {
        this.path = path
        this.name = name
        this.content = content
        this.language = language
    }
}

class Table {
    constructor(schema, name, columns, constraints) {
        this.schema = schema || null
        this.name = name
        this.columns = columns || []
        this.constraints = constraints || []
    }

    getFirstForeignReference() {
        return this.foreignReferences && this.foreignReferences.length ? this.foreignReferences[0].entityName : '';
    }
}

class TableColumn {
    constructor(name, type, properties) {
        this.name = name
        this.type = type
        this.properties = properties || []
        this.isNullable = !properties.match(/NOT\W+NULL/gim);
    }
}


class TableConstraint {
    constructor(type, keys, referencedSchema, referencedTable) {
        this.type = type
        this.keys = keys || []
        this.referencedSchema = referencedSchema || null
        this.referencedTable = referencedTable || null
    }
}


class Class {
    constructor(className, namespace, fields, base, dependencies, acessor) {
        this.className = new MultiCase(className)
        this.namespace = new MultiCase(namespace)
        this.base = new MultiCase(base) || null
        this.dependencies = dependencies || [];
        this.fields = Array.isArray(fields) ? fields : []
    }

    buildForLanguage(language) {
        const clone = new Class(this.className, this.namespace || language.defaultNamespace, this.fields, this.base, this.dependencies, this.acessor)
        clone.fields.forEach(field => {
            console.log(language.dictionary[field.type.upperCase.trim()], field.type.upperCase)
            field.type = new MultiCase(language.dictionary[field.type.upperCase.trim()] || '<Undefined Type Conversion>');
        })
        return clone
    }
}

class ClassField {
    constructor(fieldName, type, isNullable, acessor) {
        this.fieldName = new MultiCase(fieldName)
        this.type = new MultiCase( type || 'void' )
        this.isNullable = isNullable ? true : false
    }
}

class MultiCase {
  constructor(word) {
    this.word = String(word)
  }

  toString() {
    return this.word
  }

  get paramCase() {
    return changeCase.paramCase(this.word)
  }

  get pascalCase() {
    return changeCase.pascalCase(this.word)
  }

  get lowerCase() {
    return changeCase.lowerCase(this.word)
  }

  get upperCase() {
    return changeCase.upperCase(this.word)
  }

  get headerCase() {
      return changeCase.headerCase(this.word)
  }

  get pathCase() {
    return changeCase.pathCase(this.word)
  }

  get sentenceCase() {
    return changeCase.sentenceCase(this.word)
  }

  get snakeCase() {
    return changeCase.snakeCase(this.word)
  }

  get camelCase() {
    return changeCase.camelCase(this.word)
  }

  get dotCase() {
    return changeCase.dotCase(this.word)
  }

  get constantCase() {
    return changeCase.constantCase(this.word)
  }

  get namespaceLowerCase() {
    return this.dotCase
  }

  get namespacePascalCase() {
    let result = ''
    this.dotCase.split('.').forEach(part=> {
      result += (result ? '.' : '') + new MultiCase(part).pascalCase
    })
    return result
  }
}


class Table2Map {
    constructor(table) {

        this.className = new MultiCase(table.name)
        this.fields = this.mapComponents(table.columns, table.constraints) || []
    }

    mapBase(columns, constraints) {
        let base = null;

        constraints.some(constraint => {
            if (constraint.type.toLowerCase() === 'primary') {
                return constraint.keys.some(key => {
                    return columns.some(column => {
                        if (column.name.toLowerCase() === key.toLowerCase()) {
                          console.log('ok')
                            base = constraint.referencedTable
                            return true
                        }
                    })
                })
            }
        })

        return base;
    }

    mapComponents(columns, constraints) {
        const fields = [];
        if (columns) columns.forEach(column => {

            let isForeign = constraints.some(constraint => {
              //console.log(constraint.type, constraint.type.toLowerCase() === 'foreign')
                if (constraint.type.toLowerCase() === 'foreign') {
                    return constraint.keys.some(key => {
                        console.log(column.name.toLowerCase() === key.toLowerCase(), column.name.toLowerCase(),  key.toLowerCase())
                        return column.name.toLowerCase() === key.toLowerCase();
                    })
                }
            })

            if (isForeign) return;

            fields.push(new ClassField(
                column.name, // fieldName
                column.type, // type
                (/\bNOT\W+NULL\b/gim).test(column.properties) // isNullable?
            ))
        })
        return fields;
    }

}


// UTILS ---------------------------------------------

function multiMatch(str, regex, fn) {
    let match = null;
    regex = new RegExp(regex.source, regex.flags); // regex.lastIndex = 0 without changing external regex
    while (match = regex.exec(str)) fn.apply(null, match)
}

// DICTIONARIES -------------------------------------

const SQL_TO_CSHARP_DICTIONARY = { // SEE: http://stackoverflow.com/a/968734/1260526
    "BIGINT": 'Int64',
    "BINARY": 'Byte[]',
    "BIT": 'Boolean',
    "BLOB": 'byte[]',
    "BOOL": 'boolean',
    "BOOLEAN": 'boolean',
    "CHAR": '<CHAR>',
    "CURRENCY": 'decimal',
    "CURSOR": '<CURSOR>',
    "DATE": 'DateTime',
    "DATETIME": 'DateTime',
    "DATETIME2": 'DateTime',
    "DEC": 'decimal',
    "DECIMAL": 'decimal',
    "DOUBLE PRECISION": 'double',
    "DOUBLE": 'double',
    "FILESTREAM": 'FileStream',
    "FLOAT": 'float',
    "GUID": 'Guid',
    "INT": 'int',
    "INTEGER": 'int',
    "LONGTEXT": 'string',
    "MEDIUMBLOB": 'byte[]',
    "MEDIUMINT": 'int',
    "MEDIUMTEXT": 'string',
    "MONEY": 'decimal',
    "NCHAR": 'char',
    "NTEXT": 'string',
    "NUMERIC": 'long',
    "REAL": 'double',
    "SMALLINT": 'Int16',
    "SQL_VARIANT": '<SQL_VARIANT>',
    "TABLE": '<TABLE>',
    "TEXT": 'string',
    "TIME": 'DateTime',
    "TIMESTAMP": 'DateTime',
    "TINYBLOB": 'byte[]',
    "TINYINT": 'byte',
    "TINYTEXT": 'string',
    "UNIQUEIDENTIFIER": 'Guid',
    "UUID": 'Guid',
    "VARBINARY": 'boolean',
    "VARCHAR": 'string',
    "YEAR": 'DateTime'
}

// EXECUTE ------------------------------------------


const BUILTIN_LANGUAGE_DEFINITIONS = {
    'csharp': new LanguageDefinitions('C#', 'csharp', 'Core.Models', '.cs', SQL_TO_CSHARP_DICTIONARY), // name, defaultNamespace, fileExtension, dictionary
    'java': new LanguageDefinitions('Java', 'java', 'Core.Models', '.java', SQL_TO_CSHARP_DICTIONARY) // name, defaultNamespace, fileExtension, dictionary
}


let cliNamespace = process.argv[3]
fs.readFile(process.argv[2], 'utf8', (err, data) => {

    if (err) {
        return console.log(err);
    }

    generateEntitiesFiles(parseTables(data));

})
