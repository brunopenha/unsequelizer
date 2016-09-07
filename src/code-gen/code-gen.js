// HACK: Rustic, bearded, angry and sweating
'use strict'

// packages
const fs = require('fs')
const Handlebars = require('handlebars')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const changeCase = require('change-case')
const sqlServerParse = require('./parsers/sql-server-parser')

// CLASSES
const ClassField = require('./classes/ClassField')
const Class = require('./classes/Class')
const File = require('./classes/File')
const MultiCase = require('./classes/MultiCase')
const AggregationTypeEnum = require('./classes/AggregationTypeEnum')
const AggregationDefinition = require('./classes/AggregationDefinition')
const AggregationRegister = require('./classes/AggregationRegister')

// CONSTANTS
const FILE_PLATFORM_DEFINITIONS = 'platforms-definitions.json'
const DIST_FOLDER_PATH = 'dist-entities/'
const TEMPLATE_FOLDER_PATH = 'templates/'

// GLOBALS
const globalPlatformsDefinitions = JSON.parse(fs.readFileSync(FILE_PLATFORM_DEFINITIONS, 'utf8'))
let globalIsDumpMode = false
let globalSqlFilename
let globalDefsFilename
let globalAggregationDefinitions


// CLI COMMANDS
const cli = require('commander');
cli
  .version('0.0.1')

  // DUMP DEFS
cli.command('dumpdefs <sql_filename> <desired_dump_filename>')
  .description('Dump aggregation definitions file. Inform the desired dump filename.')
  .action(function(sqlFilename, defsFilename) {
    globalIsDumpMode = true
    globalSqlFilename = sqlFilename
    globalDefsFilename = defsFilename
    main()
  })

  // GENERATE
cli.command('gen <sql_filename> <aggregation_definitions_filename>')
  .description('Generate code using information of sql-script and aggregation definitions files.')
  .action(function(sqlFilename, defsFilename) {
    globalIsDumpMode = false
    globalSqlFilename = sqlFilename
    globalDefsFilename = defsFilename

    // LOAD globalAggregationDefinitions
    try {

      const definitions = new Map()
      let duplicated = false

      fs.readFileSync(globalDefsFilename, 'utf8').split(/\r?\n/gm).forEach(line => {

        const definition = AggregationDefinition.parseDefinition(line)
        if (definition) {
          const key = `${definition.referencingTable}.${definition.foreignFieldName} ${definition.foreignTable}`
          if (definitions.has(key)) {
            console.log(`Duplicated aggregation definition for: ${key}`)
            duplicated = true
          }
          else {
            definitions.set(key, definition)
          }
        }
      })
      if (duplicated) {
        console.log(`\nCould not generate files due to duplicated aggregation definitions.\n`)
        process.exit(0)
      }

      globalAggregationDefinitions = []
      definitions.forEach(value => globalAggregationDefinitions.push(value))
    }
    catch(ex) {
      return console.log(`Could not load aggregation definitions file ${defsFilename}.`)
    }

    main()
  })

cli.parse(process.argv);



function main() {

  rimraf(DIST_FOLDER_PATH, ['rmdir'], err => {
    if (err) return console.log(`Could not delete distribution folder "${DIST_FOLDER_PATH}".`)

    fs.readFile(globalSqlFilename, 'utf8', (err, data) => {
      if (err) return console.log(`Could not load sql definitions from ${globalSqlFilename} file.`);

      console.log(`\nGENERATOR STARTED ON ${globalIsDumpMode ? 'DUMP' : 'GENERATION'} MODE (MODES: DUMP/GENERATION)\n`)

      const parsedData = sqlServerParse(data)
      const classes = [];

      console.log(JSON.stringify(parsedData))

      // Map table to classes
      if (parsedData) parsedData.forEach(table => classes.push(mapTable2Class(table)))

      if (globalIsDumpMode) {
        let data = 'PLEASE REMOVE THE "#" OF YOUR DESIRED AGGREGATION FORM\n\n'

        AggregationRegister.listUnresolvedAggregation().forEach(unresolved => {
          data += `# ${AggregationDefinition.listPossibleDefinitions(unresolved).join('\n# ')}\n\n`
        })

        console.log(`\nPLEASE EDIT ${globalDefsFilename} AND RE-EXECUTE IN GENERATE MODE (gen).\n`)

        fs.writeFile(globalDefsFilename, data, err => {
          if (err) return console.log(`Could not write ${globalDefsFilename}. Internal error.`, err);
          process.exit(0)
        })

        return;
      }

      // QUIT ON MISSING DEFINITION
      //console.log(AggregationRegister.listUnresolvedAggregation().length)
      if (AggregationRegister.listUnresolvedAggregation().length) {
        console.log(`\nCould not generate files due to missing aggregation definitions.\n`)
        process.exit(0)
      }

      // RESOLVE AGGREGATED CLASS FIELDS
      const fieldAggregations = AggregationRegister.listFieldAggregations()
      classes.forEach(classDefinition => {
        // AGGREGATOR FIELD DASH
        //console.log('------------------',AggregationRegister.listFieldAggregations())
        for (let aggregator in fieldAggregations) {
          if (aggregator === classDefinition.className.toString()) {
            const aggregatorFields = fieldAggregations[aggregator]
            for (let fieldName in aggregatorFields) {
              classDefinition.fields = classDefinition.fields.concat(aggregatorFields[fieldName])
            }
          }
        }
      })

      // REITERATE MAPPING DOMAIN CLASSES TO TYPES
      classes.forEach(targetClass => {

        if (!targetClass.supertype) return;

        // Map supertype
        const possibleSupertype = classes.find(possibleSupertype => possibleSupertype.className.snakeCase === targetClass.supertype.className.snakeCase)
        if (possibleSupertype) targetClass.supertype = possibleSupertype

        // Map fields' types
        targetClass.fields.forEach(field => {
          const possibleFieldType = classes.find(possibleFieldType => possibleFieldType.className.snakeCase === field.type.className.snakeCase)
          if (possibleFieldType) field.type = possibleFieldType
        })
      })

      globalPlatformsDefinitions.forEach(language => {
        if (language.isActive) for (var pack in language.packages) generatePlatformFile(pack, classes, language)
      })
    })
  })
}

function generatePlatformFile(pack, classes, language) {

  // PATH == PACKAGE NAME
  const languageOutputFolder = DIST_FOLDER_PATH + language.folderName + '/' + changeCase.pathCase(pack) + '/';
  const templatePath = TEMPLATE_FOLDER_PATH + changeCase.pathCase(pack) + '/'

  fs.readFile(templatePath + language.folderName + '.hbs', 'utf8', (err, template) => {

    if (err) return console.log('COULD NOT FIND', templatePath + language.folderName + '.hbs');
    else console.log('FOUND', templatePath + language.folderName + '.hbs');

    mkdirp(languageOutputFolder, (err) => {
      if (err) return console.error(`COULD NOT CREATE OUTPUT FOLDER ${languageOutputFolder}.`)

      const languageWriter = Handlebars.compile(template)

      console.log(`Writing ${language.name} ${pack}...`)

      classes.forEach(classDefinition => {

        if (classDefinition.isAssociative) return;

        const languageClass = mapClass2Platform(language, classDefinition, classes)

        languageClass.namespace = pack

        const file = new File(languageOutputFolder, Handlebars.compile(language.packages[pack])(new MultiCase(languageClass.className)), languageWriter(languageClass))

        fs.writeFile(file.path + file.name, file.content, err => {
          if (err) return console.log(`COULD NOT WRITE FILE ${file.name}`);

        })
      })
    })
  })
}

function mapClass2Platform(language, classDef, classes) { // TODO create Class mapper for cleaner class definition
    const clone = classDef.clone()
    clone.namespace = clone._namespace || language.defaultNamespace
    if (language.sqlDictionary) {
       clone./*do not remove this underscore*/_fields.forEach(field => {
         if (!field.type.isDomainClassType) field.type = new Class(language.sqlDictionary[field.type.className.upperCase.trim()] || 'UNDEFINED_SQL_TYPE_MAPPING')
         if (language.nullExceptionDictionary && language.nullExceptionDictionary.indexOf(field.type.className.toString()) !== -1) field.isNullable = false
      })
    }
    return clone
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
          const primaryForeignKey = new ForeignKey(table, foreignColumn, constraint.foreignTable)

          // WHILE SIMPLE PK FK
          if (possibleSupertype == null) possibleSupertype = primaryForeignKey

          // COMPOSITE PK FK
          else if (possibleSupertype !== constraint.foreignTable) associativeTablePKs.push(primaryForeignKey)
        }
        else { // NON PRIMARY FK

          const aggregationDefinition = resolveAggregationDefinition(table.name, constraint.foreignTable, foreignKey)

          if (!aggregationDefinition) return

          switch(aggregationDefinition.aggregationType) {

            case AggregationTypeEnum.AGGREGATED_BY_ONE:
              AggregationRegister.registerFieldAggregation(
                constraint.foreignTable,
                new ClassField(
                  table.name, // fieldName
                  new Class(table.name, true), // type
                  foreignColumn.isNullable, // isNullable?
                  false // isCollection
                )
              )
              break

            case AggregationTypeEnum.AGGREGATED_BY_MANY:
              AggregationRegister.registerFieldAggregation(
                constraint.foreignTable,
                new ClassField(
                  table.name, // fieldName
                  new Class(table.name, true), // type
                  foreignColumn.isNullable, // isNullable?
                  true // isCollection
                )
              )
              break

            case AggregationTypeEnum.AGGREGATES_ONE:
              fields.push(new ClassField(
                stripIdentifier(foreignColumn.name), // fieldName
                new Class(constraint.foreignTable, true), // type
                foreignColumn.isNullable, // isNullable?
                false // isCollection
              ))
            break

            case AggregationTypeEnum.AGGREGATES_MANY:
              fields.push(new ClassField(
                stripIdentifier(foreignColumn.name), // fieldName
                new Class(constraint.foreignTable, true), // type
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
          AggregationRegister.registerFieldAggregation(
            primaryForeignKey.foreignTableName,
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
          AggregationRegister.registerFieldAggregation(
            primaryForeignKey.foreignTableName,
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

function resolveAggregationDefinition(referencingTable, foreignTable, foreignFieldName) {

  if (globalIsDumpMode) AggregationRegister.registerUnresolvedAggregation(new AggregationDefinition(referencingTable, foreignTable, foreignFieldName))
  else {
    //console.log(referencingTable, foreignTable, foreignFieldName)
    const definition = globalAggregationDefinitions.find(definition =>
      definition.referencingTable === referencingTable &&
      definition.foreignTable  === foreignTable &&
      definition.foreignFieldName === foreignFieldName
    )

  //  console.log(definition)

    if (!definition) {
      AggregationRegister.registerUnresolvedAggregation(new AggregationDefinition(referencingTable, foreignTable, foreignFieldName))
      return console.log(`Undefined aggregation: ${referencingTable}.${foreignFieldName} <-> ${foreignTable}`)
    }
    return definition
  }
}
