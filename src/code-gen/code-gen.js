// HACK: Rustic, bearded, angry and sweating
'use strict'

// packages
const fs = require('fs')
const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')
const sqlServerParse = require('./parsers/sql-server-parser')
const readlineSync = require('readline-sync')

// CLASSES
const ClassField = require('./classes/ClassField')
const Class = require('./classes/Class')
const File = require('./classes/File')
const MultiCase = require('./classes/MultiCase')
const AggregationTypeEnum = require('./classes/AggregationTypeEnum')
const AggregationDefinition = require('./classes/AggregationDefinition')

// CONSTANTS
const FILE_AGGREGATION_DEFINITIONS = 'aggregations-definitions.txt'
const FILE_PLATFORM_DEFINITIONS = 'platforms-definitions.json'
const DIST_FOLDER_PATH = 'dist-entities/'
const TEMPLATE_FOLDER_PATH = 'templates/'
const PLATFORMS = JSON.parse(fs.readFileSync(FILE_PLATFORM_DEFINITIONS, 'utf8'))

let loadedAggregationDefinitions
try { loadedAggregationDefinitions = fs.readFileSync(FILE_AGGREGATION_DEFINITIONS, 'utf8').map(line => AggregationDefinition.parseDefinition()) } catch(ex) {}
const LOADED_AGGREGATION_DEFINITIONS = loadedAggregationDefinitions || null

const unresolvedAggregations = []


const aggregatorRegister = {}
function registerAggregateField(aggregator, classField) {
  const classFields = aggregatorRegister[aggregator] || {}
  if (!classFields[classField.fieldName]) classFields[classField.fieldName] = classField
  aggregatorRegister[aggregator] = classFields
}


fs.readFile(process.argv[2], 'utf8', (err, data) => {
  if (err) return console.log(err);

  console.log('\nGENERATOR STARTED\n')

  const parsedData = sqlServerParse(data)
  const classes = [];

  // Map table to classes
  if (parsedData) parsedData.forEach(table => classes.push(mapTable2Class(table)))

  if (unresolvedAggregations) {
    let data = 'PLEASE REMOVE THE "#" OF YOUR DESIRED AGGREGATION FORM\n\n'

    if (LOADED_AGGREGATION_DEFINITIONS)
      LOADED_AGGREGATION_DEFINITIONS.forEach(loaded => {
        data += `${loaded.referencingTable} ${loaded.aggregationType} ${loaded.referencedTable} (column ${loaded.foreignFieldName} of ${aggregationDefinition.referencingTable})\n\n`
      })

    unresolvedAggregations.forEach(unresolved => {
      data += `# ${AggregationDefinition.listPossibleAggregationTypes(unresolved).join('\n# ')}\n\n`
    })

    console.log(`\nPLEASE edit ${FILE_AGGREGATION_DEFINITIONS} and try again.\n`)
    return fs.writeFile(FILE_AGGREGATION_DEFINITIONS, data, err => {
      if (err) return console.log(`Could not write ${FILE_AGGREGATION_DEFINITIONS}`, err);
    })
  }

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
    if (language.isActive) for (var pack in language.packages) generatePlatformFile(pack, classes, language)
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
            console.log(`OK\t${file.path + file.name}`)
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

function mapTable2Class(table, aggregationDefinitions) {

  const className = table.name
  const columns = table.columns
  const constraints = table.constraints

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
        else { // NON PRIMARY FK

          const aggregationDefinition = resolveAggregationDefinition(table.name, constraint.referencedTable, foreignKey)

          if (!aggregationDefinition) return

          switch(aggregationDefinition.aggregationType) {

            case AggregationTypeEnum.AGGREGATED_BY_ONE:
              registerAggregateField(constraint.referencedTable,
                new ClassField(
                  table.name, // fieldName
                  new Class(foreignColumn.type), // type
                  foreignColumn.isNullable, // isNullable?
                  false // isCollection
                )
              )
              break

            case AggregationTypeEnum.AGGREGATED_BY_MANY:
              registerAggregateField(constraint.referencedTable,
                new ClassField(
                  table.name, // fieldName
                  new Class(foreignColumn.type), // type
                  foreignColumn.isNullable, // isNullable?
                  true // isCollection
                )
              )
              break

            case AggregationTypeEnum.AGGREGATES_ONE:
              fields.push(new ClassField(
                stripIdentifier(foreignColumn.name), // fieldName
                new Class(constraint.referencedTable, true), // type
                foreignColumn.isNullable, // isNullable?
                false // isCollection
              ))
            break

            case AggregationTypeEnum.AGGREGATES_MANY:
              fields.push(new ClassField(
                stripIdentifier(foreignColumn.name), // fieldName
                new Class(constraint.referencedTable, true), // type
                foreignColumn.isNullable, // isNullable?
                true // isCollection
              ))
              break
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

      const aggregationDefinition = resolveAggregationDefinition(primaryForeignKey.table.name, primaryForeignKey.foreignTableName, foreignColumn.name)
      if (!aggregationDefinition) return

      switch(aggregationDefinition.aggregationType) {

        case AggregationTypeEnum.AGGREGATED_BY_ONE:
          new ClassField(
            stripIdentifier(foreignColumn.name), // fieldName
            new Class(foreignColumn.type, false), // type
            foreignColumn.isNullable, // isNullable?
            false // isCollection
          )
          break

        case AggregationTypeEnum.AGGREGATED_BY_MANY:
          new ClassField(
            stripIdentifier(foreignColumn.name), // fieldName
            new Class(foreignColumn.type, false), // type
            foreignColumn.isNullable, // isNullable?
            true // isCollection
          )
          break

        case AggregationTypeEnum.AGGREGATES_ONE:
          registerAggregateField(primaryForeignKey.foreignTableName,
            new ClassField(
              stripIdentifier(primaryForeignKey.foreignTableName), // fieldName
              new Class(primaryForeignKey.foreignTableName, true), // type
              // TODO aggregator isNullable?
              true, // isNullabe
              false // isCollection
            )
          )
          break

        case AggregationTypeEnum.AGGREGATES_MANY:
          registerAggregateField(primaryForeignKey.foreignTableName,
            new ClassField(
              stripIdentifier(primaryForeignKey.foreignTableName), // fieldName
              new Class(primaryForeignKey.foreignTableName, true), // type
              // TODO aggregator isNullable?
              true, // isNullabe
              true // isCollection
            )
          )
          break
      }
    })
  }

  // PROCESS FIELDS NOT PRESENT IN CONSTRAINTS
  fields = columns.filter(column => constraintKeys.indexOf(column.name) === -1) // FILTERS OUT COLUMNS IN PRIMARY/FOREIGN KEY
    .map(column =>
      new ClassField(
        column.name, // fieldName
        new Class(column.type), // type
        column.isNullable, // isNullable?
        false // isCollection
      )
    ).concat(fields)

  return new Class(className, true, null, fields, possibleSupertype ? new Class(possibleSupertype.foreignTableName) : null, null, associativeTablePKs.length)
}

function stripIdentifier(fieldName) {
  return fieldName.replace(/(?:\b|_|\s)id(?:\b|_|\s)/i, '');
}

function resolveAggregationDefinition(referencingTable, referencedTable, foreignFieldName) {

  let definitions
  if (Array.isArray(LOADED_AGGREGATION_DEFINITIONS))
    definitions = LOADED_AGGREGATION_DEFINITIONS.find(definition =>
      possibleDefinition.referencingTable === referencingTable &&
      possibleDefinition.referencedTable === referencedTable &&
      possibleDefinition.foreignFieldName === foreignFieldName
    )
  if (!definitions) {
    unresolvedAggregations.push(new AggregationDefinition(referencingTable, referencedTable, foreignFieldName))
    console.log(`Could not find aggregation definition for: ${referencingTable} <-> ${referencedTable} (column ${foreignFieldName} of ${referencingTable})`)
  }
  return definitions
}
