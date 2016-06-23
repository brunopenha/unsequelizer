const fs = require('fs');
const Handlebars = require('handlebars');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');


let cliNamespace = process.argv[3]


const DIST_FOLDER_PATH = 'dist-entities/'
// PROCESS -------------------------------------------


const REGEX_CONSTRAINT_REFERENCE =
  /\W*CONSTRAINT\b[^,)]+FOREIGN\W+KEY[\s\S]+?REFERENCES\W+(?:(\w+)\W+)?(\w+)/gim; // [schema, fk entity]



function parseTables(data) {

  const SQL_DATA_TYPES = 'CHAR|VARCHAR|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|BINARY|VARBINARY|BIT|TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|DECIMAL|DEC|NUMERIC|FIXED|FLOAT|DOUBLE|DOUBLE[^w|;]+PRECISION|REAL|BOOL|BOOLEAN|DATE|DATETIME|DATETIME2|UNIQUEIDENTIFIER|UUID|GUID|TIMESTAMP|TIME|YEAR|TINYBLOB|BLOB|MEDIUMBLOB|FILESTREAM|NUMERIC|LONGTEXT|MONEY|CURRENCY|NCHAR|NTEXT|SQL_VARIANT|TABLE|CURSOR';

  const REGEX_CREATE_TABLE = /\bCREATE\W+TABLE[^;]+/gim
  const REGEX_TABLE_SCHEMA_NAME = /\bCREATE\W+TABLE.+?(?:(\w+)\W*\.\W*)?(\w+)\W*\(/gim
  const REGEX_TABLE_CONTENT = /\bCREATE\W+TABLE[^(]+\(([\s\S]+)\)/gim

  const REGEX_NOT_COLUMN = /^\W*(?:PRIMARY\W+KEY|CONSTRAINT)[^,]+,?/gim

  const REGEX_TABLE_COLUMN = new RegExp('(?:\\W*(\\w+)\\W+('+ SQL_DATA_TYPES+')(?:\\W*\\([^)]+\\))?([\\s\\S]+))', 'gim') // [name, type, properties]

  const REGEX_CONSTRAINT_REFERENCE =
    /\W*CONSTRAINT[^,)]+(PRIMARY|FOREIGN)\W+KEY\W*\(([^)]+)\)(?:\W+REFERENCES\W+(?:(\w+)\W*\.\W*)?(\w+))?/gim; // [type, keys, schema, referenced table]



  const tables = []

  multiMatch(data.replace(/(?:\r?\n|\s)+/gim, ' ').replace(), REGEX_CREATE_TABLE, table => {

    REGEX_TABLE_SCHEMA_NAME.lastIndex = 0
    const titleMatch = REGEX_TABLE_SCHEMA_NAME.exec(table)
    const tableSchema = titleMatch[1]
    const tableName = titleMatch[2]

    multiMatch(table, REGEX_TABLE_CONTENT, (match, content) => {

      const columns = []
      const constraints = []

      content.split(',').forEach(command => {

      //console.log(command)

        if (REGEX_NOT_COLUMN.test(command)) {


          if (REGEX_CONSTRAINT_REFERENCE.test(command)) {

            multiMatch(command, REGEX_CONSTRAINT_REFERENCE, (declaration, type, keys, referencedSchema, referencedTable) => {

              constraints.push(new TableConstraint(type, keys.split(','), referencedSchema, referencedTable))
            })
          }
        }
        else {

          multiMatch(command, REGEX_TABLE_COLUMN, (column, name, type, properties) => {

            columns.push(new TableColumn(name, type, properties))
          })
        }
      })

      tables.push(new Table(tableSchema, tableName, columns, constraints))
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
      this.schema = schema
      this.name = name
      this.columns = columns
      this.constraints = constraints || []
  }

  getFirstForeignReference() {
    return this.foreignReferences && this.foreignReferences.length ? this.foreignReferences[0].entityName: '';
  }
}

class TableColumn {
  constructor(name, type, properties) {
    this.name = name
    this.type = type
    this.properties = properties
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


class Class{
  constructor(className, namespace, fields, base, dependencies, acessor) {
    this.className = className
    this.namespace = namespace
    this.base = base || null
    this.dependencies = dependencies || [];
    this.acessor = acessor || 'public'
    this.fields = Array.isArray(fields) ? fields : []
  }

  buildForLanguage(language) {
    const clone = new Class(this.className, this.namespace || language.defaultNamespace , this.fields, this.base, this.dependencies, this.acessor)
    clone.fields.forEach(field => {
      field.type = language.dictionary[field.type.trim().toUpperCase()] || '<Undefined Type Conversion>';
    })
    return clone
  }
}

class ClassField {
  constructor(fieldName, type, isNullable, acessor) {
    this.fieldName = fieldName
    this.type = type || 'void'
    this.isNullable = isNullable
    this.acessor = acessor || 'private'
  }
}


class Table2Map {
  constructor(table) {
    // TODO implement mapper sql to entity namespace

    this.className = this.formatClassName(table.name)
    //this.base  = this.mapBase(table.columns, table.constraints) || '';
    this.fields = this.mapComponents(table.columns, table.constraints) || []
  }



  mapBase(columns, constraints) {
    let base = null;

    constraints.some(constraint => {
      if (constraint.type.toLowerCase() === 'primary') {
        return constraint.keys.some(key => {
          return columns.some(column => {
            if (column.name.toLowerCase() === key.toLowerCase()) {
              base = this.formatClassName(constraint.referencedTable)
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
    if (columns)  columns.forEach(column => {

      let isForeign = constraints.some(constraint => {
        if (constraint.type.toLowerCase() === 'foreign') {
          return constraint.keys.some(key => {
            return column.name.toLowerCase() === key.toLowerCase();
          })
        }
        else return false;
      })

      if (isForeign) return;

      fields.push(new ClassField(
        this.formatFieldName(column.name), // fieldName
        column.type, // type
        (/\bNOT\W+NULL\b/gim).test(column.properties) // isNullable?
      ))
    })
    return fields;
  }

  formatFieldName(name) {
    return name.trim().replace(/_/gim, '')
  }

  formatClassName(name) {
    return name.trim().replace(/_/gim, '')
  }
}


// UTILS ---------------------------------------------

function multiMatch(str, regex, fn) {
  let match = null;
  regex = new RegExp(regex.source,regex.flags); // regex.lastIndex = 0 without changing external regex
  while(match = regex.exec(str)) fn.apply(null, match)
}

// DICTIONARIES -------------------------------------

const SQL_TO_CSHARP_DICTIONARY = {
  "CHAR": 'string',
  "VARCHAR": 'string',
  "TINYTEXT": 'string',
  "TEXT": 'string',
  "MEDIUMTEXT": 'string',
  "LONGTEXT": 'string',
  "BINARY": 'boolean',
  "VARBINARY": 'boolean',
  "BIT": 'boolean',
  "TINYINT": 'byte',
  "SMALLINT": 'Int16',
  "MEDIUMINT": 'int',
  "INT": 'int',
  "INTEGER": 'int',
  "BIGINT": 'long',
  "DECIMAL": 'decimal',
  "DEC": 'decimal',
  "NUMERIC": 'long',
  "FLOAT": 'float',
  "DOUBLE": 'double',
  "DOUBLE PRECISION": 'double',
  "REAL": 'double',
  "BOOL": 'boolean',
  "BOOLEAN": 'boolean',
  "DATE": 'DateTime',
  "DATETIME": 'DateTime',
  "DATETIME2": 'DateTime',
  "UNIQUEIDENTIFIER": 'Guid',
  "UUID": 'Guid',
  "GUID": 'Guid',
  "TIMESTAMP": 'DateTime',
  "TIME": 'DateTime',
  "YEAR": 'DateTime',
  "TINYBLOB": 'byte[]',
  "BLOB": 'byte[]',
  "MEDIUMBLOB": 'byte[]',
  "FILESTREAM": 'FileStream',
  "MONEY": 'decimal',
  "CURRENCY": 'decimal',
  "NCHAR": 'char',
  "NTEXT": 'string',
  "SQL_VARIANT": '<SQL_VARIANT>',
  "TABLE": '<TABLE>',
  "CURSOR": '<CURSOR>'
}

// EXECUTE ------------------------------------------


const BUILTIN_LANGUAGE_DEFINITIONS = {
  'csharp': new LanguageDefinitions('C#', 'csharp', 'Core.Models', '.cs', SQL_TO_CSHARP_DICTIONARY) // name, defaultNamespace, fileExtension, dictionary
}



fs.readFile(process.argv[2], 'utf8', (err, data) => {

    if (err) {
        return console.log(err);
    }

    const parsedData = parseTables(data);
        //console.log(JSON.stringify(parsedData))

     generateEntitiesFiles(parsedData);

})
