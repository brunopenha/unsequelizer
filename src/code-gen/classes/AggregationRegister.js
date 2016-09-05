const Class = require('./Class')
const ClassField = require('./ClassField')
const AggregationDefinition = require('./AggregationDefinition')

module.exports =

class AggregationRegister {

  static registerFieldAggregation(aggregator, classField) {

      if (typeof aggregator !== 'string') throw new TypeError('aggregator is not a instance of Class')
      if (!(classField instanceof ClassField)) throw new TypeError('classField is not a instance of ClassField')

      const register = this._register || (this._register = {})
      const classFields = register[aggregator] || (register[aggregator] = {})

      // TODO test for classfield duplication
      if (!classFields[classField.fieldName]) classFields[classField.fieldName] = classField
  }

  static listFieldAggregations() {
    return this._register || (this._register = {})
  }

  static registerUnresolvedAggregation(aggregationDefinition) {

    if (!(aggregationDefinition instanceof AggregationDefinition)) throw new TypeError('aggregationDefinition is not a instance of AggregationDefinition')

    const aggregationDefs = this._aggregationDefs || (this._aggregationDefs = [])
    aggregationDefs.push(aggregationDefinition)
  }

  static listUnresolvedAggregation() {
    if (!this._aggregationDefs) this._aggregationDefs = []
    return  this._aggregationDefs.slice(0)
  }
}
