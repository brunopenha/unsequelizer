const Class = require('./Class')
const ClassField = require('./ClassField')

module.exports =

class AggregationRegister {

  static registerAggregateField(aggregator, classField) {

      if (!(aggregator instanceof Class) throw new TypeError('aggregator is not a instance of Class')
      if (!(classField instanceof ClassField) throw new TypeError('classField is not a instance of ClassField')

      const register = this._register || (this._register = [])
      const classFields = register[aggregator] || (register[aggregator] = {})

      if (!classFields[classField.fieldName]) classFields[classField.fieldName] = classField
  }

  static getRegisteredAggregateFields() {
    return this._register.slice(0)
  }
}
