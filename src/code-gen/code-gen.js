// HACK: Rustic, bearded, angry and sweating
'use strict'
const fs = require('fs')
const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')
const sqlServerParse = require('./parsers/sql-server-parser')
const classes = require('./classes')
var readlineSync = require('readline-sync')

const ClassField = classes.ClassField
const Class = classes.Class
const File = classes.File
const MultiCase = classes.MultiCase

const DIST_FOLDER_PATH = 'dist-entities/'
const TEMPLATE_FOLDER_PATH = 'templates/'
const PLATFORMS = JSON.parse(fs.readFileSync('platforms-definitions.json', 'utf8'))

const AGGREGATION_ANSWERS = ['IS AGGREGATED BY (1:1)', 'IS AGGREGATED BY (M:1)',  'AGGREGATES ONE (1:1)', 'AGGREGATES MANY (1:M)']

const aggregators = {}

function aggregatorField(aggregator, field) {
  const fields = aggregators[aggregator] || {}
  if (!fields[field.fieldName]) fields[field.fieldName] = field
  aggregators[aggregator] = fields
}


fs.readFile(process.argv[2], 'utf8', (err, data) => {
  if (err) return console.log(err);

  console.log('\nGENERATOR STARTED\n')

  const parsedData = sqlServerParse(data)
  const classes = [];

  // Map table to classes
  if (parsedData) parsedData.forEach(table => classes.push(mapTable2Class(table)))

  // Reiterate mapping supertypes
  classes.forEach(targetClass => {

    if (!targetClass.supertype) return;

    const possibleSupertype = classes.find(possibleSupertype => possibleSupertype.className.snakeCase === targetClass.supertype.className.snakeCase)
    if (possibleSupertype) targetClass.supertype = possibleSupertype

    targetClass.fields.forEach(field => {
      const possibleFieldType = classes.find(possibleFieldType => possibleFieldType.className.snakeCase === field.type.className.snakeCase)
      if (possibleFieldType) field.type = possibleFieldType
    })

  })

  classes.forEach(classDefinition => {
    // AGGREGATOR FIELD DASH
    for (let aggregator in aggregators) {
      if (aggregator === classDefinition.className.toString()) {
        const aggregatorFields = aggregators[aggregator]
        for (let fieldName in aggregatorFields) {
          classDefinition.fields = classDefinition.fields.concat(aggregatorFields[fieldName])
        }
      }
    }
  })

  PLATFORMS.forEach(language => {
    if (language.isActive)
      for (var pack in language.packages) generatePlatformFile(pack, classes, language)
  })
})

function generatePlatformFile(pack, classes, language) {

  // PATH == PACKAGE NAME
  const languageOutputFolder = DIST_FOLDER_PATH + language.folderName + '/' + changeCase.pathCase(pack) + '/';
  const templatePath = TEMPLATE_FOLDER_PATH + changeCase.pathCase(pack) + '/'

  fs.readFile(templatePath + language.folderName + '.hbs', 'utf8', (err, template) => {

    if (err) return console.log('COULD NOT FIND', templatePath + language.folderName + '.hbs');
    else console.log('FOUND', templatePath + language.folderName + '.hbs');

    rimraf(languageOutputFolder, ['rmdir'], err => {
      if (err) return console.log(err)

      mkdirp(languageOutputFolder, (err) => {
        if (err) return console.error(err)

        const languageWriter = Handlebars.compile(template)

        classes.forEach(classDefinition => {

          if (classDefinition.isAssociative) return;

          const languageClass = classDefinition.cloneForLanguage(language)

          languageClass.namespace = pack

          const file = new File(languageOutputFolder, Handlebars.compile(language.packages[pack])(new MultiCase(languageClass.className)), languageWriter(languageClass))

          fs.writeFile(file.path + file.name, file.content, err => {
            if (err) return console.log(file.path, err);
            console.log('OK\t' + file.path + file.name)
          })
        })
      })
    })
  })
}

class ForeignKey {
  constructor(table, foreignColumn, foreignTableName) {
    this.table = table
    this.foreignTableName = foreignTableName
    this.foreignColumn = foreignColumn
  }
}

function mapTable2Class(table) {

  const className = table.name
  const columns = table.columns
  const constraints = table.constraints

  let aggregations = []

  const doAggregationQuestion = (a, b) => {
    a = changeCase.swapCase(a)
    b = changeCase.swapCase(b)

    console.log('\n ' + a + ' __________ ' + b)
    const index = readlineSync.keyInSelect(AGGREGATION_ANSWERS, null, { cancel: true })
    if (index < 1) {
      console.log('\nOPERATION CANCELED.\n')
      process.exit(0)
    }
    aggregations.push(a + ' ' + AGGREGATION_ANSWERS[index] + ' '+ b)
    return index
  }

  while(aggregations.length === 0) {

    let possibleSupertype = null
    const associativeTablePKs = []
    const constraintKeys = []

    let fields = []

    constraints.forEach(constraint => {

      if (constraint.type.toUpperCase() === 'FOREIGN') {

        constraint.keys.forEach(foreignKey => {

          const foreignColumn = columns.find(column => column.name === foreignKey)

          // FOREIGN COMPOSES PRIMARY (Many to many) ?
          const composesPrimary = constraints.some(comparedConstraint =>
            changeCase.upperCase(comparedConstraint.type) === 'PRIMARY' ? comparedConstraint.keys.some(primaryKey => foreignKey === primaryKey) : false
          )

          // THIS FK COMPOSES PRIMARY KEY?
          if (composesPrimary) {
            const primaryForeignKey = new ForeignKey(table, foreignColumn, constraint.referencedTable)

            // WHILE SIMPLE PK FK
            if (possibleSupertype == null) possibleSupertype = primaryForeignKey

            // COMPOSITE PK FK
            else if (possibleSupertype !== constraint.referencedTable) associativeTablePKs.push(primaryForeignKey)
          }
          else {

            // NON PRIMARY FK
            const index = doAggregationQuestion(className, constraint.referencedTable)

            switch(index) {
              case 1: // AGREGGATED BY (1:1)
              case 2: // AGREGGATED BY (M:1)
                aggregatorField(constraint.referencedTable,
                  new ClassField(
                    table.name, // fieldName
                    new Class(foreignColumn.type), // type
                    foreignColumn.isNullable, // isNullable?
                    index === 2 // isCollection
                  )
                )
                break;

              case 3: // AGREGGATES ONE (1:1)
              case 4: // AGREGGATES MANY (1:M)
                fields.push(new ClassField(
                  stripIdentifier(foreignColumn.name), // fieldName
                  new Class(constraint.referencedTable, true), // type
                  foreignColumn.isNullable, // isNullable?
                  index === 4 // isCollection
                ))
                break;
            }
          }

          constraintKeys.push(foreignKey)
        })
      }
    })

    // PROCESS ASSOCIATIVE TABLE KEYS
    if (associativeTablePKs.length) {

      associativeTablePKs.push(possibleSupertype)
      possibleSupertype = null // ASSOCIATIVE CANNOT HAVE SUPERTYPE

      associativeTablePKs.forEach(primaryForeignKey => {

        const index = doAggregationQuestion(primaryForeignKey.foreignTableName, primaryForeignKey.table.name)

        switch(index) {
          case 1: // IS AGGREGATED BY (1:1)
          case 2: // IS AGGREGATED BY (M:1)
            new ClassField(
              stripIdentifier(foreignColumn.name), // fieldName
              new Class(foreignColumn.type, false), // type
              foreignColumn.isNullable, // isNullable?
              index === 2 // isCollection
            )
            break;

          case 3: // AGGREGATES ONE (1:1)
          case 4: // AGGREGATES MANY (1:M)
            aggregatorField(primaryForeignKey.foreignTableName,
              new ClassField(
                stripIdentifier(primaryForeignKey.foreignTableName), // fieldName
                new Class(primaryForeignKey.foreignTableName, true), // type
                // TODO aggregator isNullable?
                true, // isNullabe
                index === 4 // isCollection
              )
            )
            break;
        }
      })
    }

    // PROCESS FIELDS NOT PRESENT IN CONSTRAINTS
    fields = columns.filter(column => { // FILTERS OUT COLUMNS IN PRIMARY/FOREIGN KEY
      return constraintKeys.indexOf(column.name) === -1
    }).map(column => {
      return new ClassField(
        column.name, // fieldName
        new Class(column.type), // type
        column.isNullable, // isNullable?
        false // isCollection
      )
    }).concat(fields)

    if (aggregations.length) {
      console.log('\n' + aggregations.join('\n'))

      if (readlineSync.keyInYN('\nIs this correct?') === false) {
        aggregations = []
        continue
      }
    }
    return new Class(className, true, null, fields, possibleSupertype ? new Class(possibleSupertype.foreignTableName) : null, null, associativeTablePKs.length)
  }
}

function stripIdentifier(fieldName) {
  return fieldName.replace(/(?:\b|_|\s)id(?:\b|_|\s)/i, '');
}
