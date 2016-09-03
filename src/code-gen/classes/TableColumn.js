module.exports =

class TableColumn {
    constructor(name, type, properties) {
        this.name = name
        this.type = type
        this.properties = properties || []
        this.isNullable = !properties.match(/NOT\W+NULL/gim);
    }
}
