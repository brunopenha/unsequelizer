
const ForeignKey = require('./ForeignKey')
const ClassField = require('./ClassField')
const Class = require('./Class')
const AggregationDefinition = require('./AggregationDefinition')

module.exports =

class SqlProcessor {

  constructor() {
    this.aggregationRegister = aggregationRegister
    this.isOnDumpMode = isOnDumpMode
  }

  static produceClasses(tables, aggregationRegister, isOnDumpMode = false) {

    // RESOLVE PRIMARY/FOREIGN KEYS REFERENCES
    tables.forEach(table =>
      table.columns.forEach(column =>
        table.constraints.forEach(constraint => {

          switch (constraint.type.toUpperCase()) {

            case 'PRIMARY': // HAS PRIMARY CONSTAINT?
              if (!column.isPrimaryKey) column.isPrimaryKey = constraint.keys.some(key => key === column.name)
              break

            case 'FOREIGN': // HAS FOREIGN CONSTRAINT?
              constraint.keys.forEach((key, index) => {
                if (key !== column.name) return
                if (column.foreignRef) console.error(`A ${table.name}.${column.name} IS REFERENCED IN MORE THAN ONE FOREIGN KEY CONSTRAINTS.`)
                column.foreignRef = new ForeignKey(constraint.foreignTable, constraint.foreignColumns[index]) // MATCH COMPOUND FK COLUMN
              })
              break

            default:
              return console.debug(`IGNORING CONSTRAINT WITH TYPE ${constraint.type}`)
          }
        })
      )
    )

    const classes = tables.map(table => mapTable2Class(table, aggregationRegister, isOnDumpMode))

    // RESOLVE AGGREGATED CLASS FIELDS
    const fieldAggregations = aggregationRegister.listFieldAggregations()
    classes.forEach(classDefinition => {

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

    return classes
  }
}

function mapTable2Class(table, aggregationRegister, isOnDumpMode = false) {

  const associativeTablePKs = []
  const fields = []
  let possibleSupertypeColumn = null
  let isAssociative = false

  table.columns.forEach(column => {

    if (column.foreignRef) {

        // ----- PRIMARY FOREIGN KEY -----
        if (column.isPrimaryKey) {
          if (possibleSupertypeColumn == null && !isAssociative) possibleSupertypeColumn = column // register possible supertype
          else if (possibleSupertypeColumn.foreignRef.foreignTable !== constraint.foreignTable) { // 2+ PKs pointing 2+ tables == ASSOCIATIVE TABLE
            isAssociative = true
            processAssociative(table, columm)
            if (possibleSupertypeColumn) {
              processAssociative(table, possibleSupertypeColumn)
              possibleSupertypeColumn = null
            }
          }
          // else {} // COMPOSITE PK
        }

        // ----- COMMON FOREIGN KEY -----
        else {

          const aggregationDefinition = resolveAggregationDefinition(table.name, column.name, column.foreignRef.foreignTable, aggregationRegister, isOnDumpMode)

          if (!aggregationDefinition) return

          switch(aggregationDefinition.aggregationType) {

            case AggregationTypeEnum.AGGREGATED_ONCE_BY:
              aggregationRegister.registerFieldAggregation(column.foreignRef.foreignTable,

                // fieldName, type, isNullable, isCollection, access, isClassIdentifier
                new ClassField(table.name, new Class(table.name, true), column.isNullable, false)
              )
              break

            case AggregationTypeEnum.MULTI_AGGREGATED_BY:
              aggregationRegister.registerFieldAggregation(column.foreignRef.foreignTable,

                // fieldName, type, isNullable, isCollection, access, isClassIdentifier
                new ClassField(table.name, new Class(table.name, true), column.isNullable, true)
              )
              break

            case AggregationTypeEnum.AGGREGATES_ONE:
              fields.push(
                // fieldName, type, isNullable, isCollection, access, isClassIdentifier
                new ClassField(stripIdentifier(column.name), new Class(column.foreignRef.foreignTable, true), column.isNullable, false))
            break

            case AggregationTypeEnum.AGGREGATES_MANY:
              fields.push(
                // fieldName, type, isNullable, isCollection, access, isClassIdentifier
                new ClassField(stripIdentifier(column.name), new Class(column.foreignRef.foreignTable, true), column.isNullable, true))
              break
          }
        }
    }
    // ----- COMMON COLUMN -----
    else {
      fields.push(
        new ClassField(
          column.name, // fieldName
          new Class(column.type), // type
          column.isNullable, // isNullable?
          false, // isCollection
          null,
          column.isPrimaryKey
        )
      )
    }
  })
  return new Class(table.name, true, null, fields, possibleSupertypeColumn ? new Class(possibleSupertypeColumn.foreignRef.foreignTable) : null, null, associativeTablePKs.length)
}

function processAssociative(table, columm) {

  const primaryForeignKey = column.foreignRef

  // referencingTable, foreignTable, columnName, aggregationRegister, isOnDumpMode = false
  const aggregationDefinition = resolveAggregationDefinition(table.name, column.name, primaryForeignKey.foreignTable, aggregationRegister, isOnDumpMode)
  if (!aggregationDefinition) return

  switch(aggregationDefinition.aggregationType) {

    case AggregationTypeEnum.AGGREGATED_ONCE_BY:
      fields.push(
        // fieldName, type, isNullable, isCollection, access, isClassIdentifier
        new ClassField(stripIdentifier(columm.name), new Class(columm.type, false), columm.isNullable, false)
      )
      break

    case AggregationTypeEnum.MULTI_AGGREGATED_BY:
      fields.push(
        // fieldName, type, isNullable, isCollection, access, isClassIdentifier
        new ClassField(stripIdentifier(columm.name), new Class(columm.type, false), columm.isNullable, true)
      )
      break

    case AggregationTypeEnum.AGGREGATES_ONE:
      aggregationRegister.registerFieldAggregation(primaryForeignKey.foreignTableName,

        // fieldName, type, isNullable, isCollection, access, isClassIdentifier
        new ClassField(stripIdentifier(primaryForeignKey.foreignTableName), new Class(primaryForeignKey.foreignTableName, true), true, false)
      )
      break

    case AggregationTypeEnum.AGGREGATES_MANY:
      aggregationRegister.registerFieldAggregation(primaryForeignKey.foreignTableName,

        // fieldName, type, isNullable, isCollection, access, isClassIdentifier
        new ClassField(stripIdentifier(primaryForeignKey.foreignTableName), new Class(primaryForeignKey.foreignTableName, true), true, true)
      )
      break
  }
}

function stripIdentifier(fieldName) {
  return fieldName.replace(/(?:\b|_|\s)id(?:\b|_|\s)/i, '');
}

function resolveAggregationDefinition(referencingTable, columnName, foreignTable, aggregationRegister, isOnDumpMode = false) {
  //console.log(referencingTable, foreignTable, columnName)
  if (isOnDumpMode)
    aggregationRegister.registerAggregationDefinition(new AggregationDefinition(referencingTable, foreignTable, columnName))

  else {
    //console.log(referencingTable, foreignTable, columnName)
    const definition = aggregationRegister.listResolvedAggregation().find(definition =>
      definition.referencingTable === referencingTable &&
      definition.foreignTable  === foreignTable &&
      definition.foreignFieldName === columnName
    )

    if (!definition) {
      aggregationRegister.registerAggregationDefinition(new AggregationDefinition(referencingTable, foreignTable, columnName))
      return console.log(`UNDEFINED AGGREGATION: ${referencingTable}.${columnName} <-> ${foreignTable}`)
    }
    return definition
  }
}
