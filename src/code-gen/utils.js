'use strict'
module.exports.multiMatch = function multiMatch(str, regex, fn) {
    let indexBefore = regex.lastIndex
    regex.lastIndex = 0
    fn.apply(null, regex.exec(str))
    if (regex.global) {
        let match
        while (match = regex.exec(str)) fn.apply(null, match)
    }
    regex.lastIndex = indexBefore
}
