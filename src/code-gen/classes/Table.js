const changeCase = require('change-case')

module.exports =

class Table {
    constructor(schema, name, columns = null, constraints = null) {
        this.schema = schema // string
        this.name = name // string
        this.columns = columns
        this.constraints = constraints
    }

    get columns() { return this._columns || (this._columns = []) }
    set columns(value) { this._columns = value }

    get constraints() { return this._constraints || (this._constraints = []) }
    set constraints(value) { this._constraints = value }
}
