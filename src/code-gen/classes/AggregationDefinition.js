const AggregationTypeEnum = require('./AggregationTypeEnum')

module.exports =

class AggregationDefinition {
    constructor(referencingTable, referencedTable, foreignFieldName, aggregationType) {
      this.referencingTable = referencingTable // string
      this.referencedTable = referencedTable // string
      this.foreignFieldName = foreignFieldName // string
      this.aggregationType = aggregationType   // string
    }

    static parseDefinition(value) {
      // "REFERENCING_ENTITY.COLUMN AGGREGATION_TYPE REFERENCED_ENTITY"
      const matches = String(value).match(/\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+\(\s*column\s+([^\s]+).+/i)
      if (matches) {
        const referencingTable = matches[1]
        const referencedTable = matches[3]
        const foreignFieldName = matches[4]
        const aggregationType = matches[2]
        for (const enumType in AggregationTypeEnum) {
          if (changeCase.snakeCase(aggregationType) === changeCase.snakeCase(enumType)) {
            return new AggregationDefinition(referencingTable, referencedTable, foreignFieldName, aggregationType)
          }
        }
      }
      return null
    }

    get isResolved() {
      return !!(this.referencingTable  &&
      this.referencedTable  &&
      this.foreignFieldName &&
      this.aggregationType)
    }

    static listPossibleAggregationTypes(aggregationDefinition) {
      const possibilities = []
      if (aggregationDefinition.isResolved === false) {
        for (const aggregationType in AggregationTypeEnum)
          possibilities.push(`${aggregationDefinition.referencingTable} ${aggregationType} ${aggregationDefinition.referencedTable} (column ${aggregationDefinition.foreignFieldName} of ${aggregationDefinition.referencingTable})`)
      }
      return possibilities
    }
}
