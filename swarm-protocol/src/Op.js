"use strict";
var Base64x64 = require('./Base64x64');
var Stamp = require('./Stamp');
var Spec = require('./Spec');

/**
 *  Immutable Swarm op, see the specification at
 *  https://gritzko.gitbooks.io/swarm-the-protocol/content/op.html
 * */
class Op {

    constructor (spec, value, source) {
        this._spec = this._value = null;
        if (spec===undefined) {
            return Op.NON_SPECIFIC_NOOP;
        } else if (spec.constructor===Op) {
            this._spec = spec._spec;
            this._value = spec._value;
            //this._source = spec._source;
        } else if (spec.constructor===Spec) {
            this._spec = spec;
            this._value = value.toString();
            //this._source = source || Stamp.ZERO;
        } else if (spec.constructor===String) {
            this._spec = new Spec(spec);
            this._value = value.toString();
            //this._source = source || Stamp.ZERO;
        } else {
            throw new Error("unrecognized parameter");
        }
    }

    get spec () {
        return this._spec;
    }

    get specifier () {
        return this._spec;
    }

    get value () {
        return this._value;
    }

    /** an immediate connection id this op was received from, where
     *  op.source.value is a connection id per se, while
     *  op.source.origin is the id of the connected replica
     *  (op.spec.origin is the id of a replica that created the op) */
    get source () {
        return this._source;
    }

    get origin () {
        return this._spec.origin;
    }

    get scope () {
        return this._spec.scope;
    }

    toString () {
        let ret = this._spec.toString();
        if (!this._value) {
        } else if (this._value.indexOf('\n')===-1) {
            ret += '\t' + this._value;
        } else {
            ret += '=\n' + this._value.replace(/^(.*)$/mg, "\t$1");
        }
        return ret;
    }

    /** whether this is not a state-mutating op */
    isPseudo () {
        return Op.PSEUDO_OP_NAMES.indexOf(this._spec.name.value)!==-1;
    }

    /** parse a frame of several serialized concatenated newline-
     * terminated ops. Does not parse buffers (because partial ops,
     * partial Unicode chars). */
    static parseFrame (text, source) {
        var ret = [];
        var m = null;
        Op.reOp.lastIndex = 0;
        while ( m = Op.reOp.exec(text) ) {
            let spec = m[1],
                empty = m[2],
                line = m[3],
                lines = m[4],
                length = m[5],
                value;
            if (empty!==undefined) {
                value = '';
            } else if (line!==undefined) {
                value = line;
            } else if (lines!==undefined) {
                value = lines.replace(/\n[ \t]/mg, '\n').substr(1);
            } else { // explicit length
                var char_length = Base64x64.classic.parse(length);
                var start = Op.reOp.lastIndex;
                value = text.substr(start, char_length);
                if (text.charAt(start+char_length)!=='\n') {
                    throw new Error('unterminated op body');
                }                Op.reOp.lastIndex = start+char_length;
            }
            ret.push(new Op(spec, value, source));
        }
        if (Op.reOp.lastIndex!==0) {
            throw new Error("mismatched content");
        }
        return ret;
    }

    get type () { return this._spec.type; }
    get id () { return this._spec.id; }
    get stamp () { return this._spec.stamp; }
    get name () { return this._spec.name; }
    get typeid () { return this._spec.typeid; }

    isOn () { return this.spec.method === Op.METHOD_ON; }

    isOff () { return this.spec.method === Op.METHOD_OFF; }

    isOnOff () {
        return this.isOn() || this.isOff();
    }

    isMutation () {
        return !this.isOnOff() && !this.isError() && !this.isState();
    }

    isState () {
        return this.spec.method === Op.METHOD_STATE;
    }

    isNoop () {
        return this.spec.method === Op.METHOD_NOOP;
    }

    isError () {
        return this.spec.method === Op.METHOD_ERROR;
    }

    isSameObject (spec) {
        if (spec.constructor===Op) {
            spec = spec.spec;
        } else if (spec.constructor!==Spec) {
            spec = new Spec(spec);
        }
        return this.spec.isSameObject(spec);
    }

    /**
     * @param {String} message
     * @returns {Op} error op */
    error (message) {
        return new Op(this.spec.rename(Stamp.ERROR), message);
    }

    /** @param {Base64x64|String} stamp */
    overstamped (stamp) {
        if (this.spec.isScoped())
            throw new Error('can not overstamp a scoped op');
        let spec = new Spec([
            this.spec.Type,
            this.spec.Id,
            new Stamp(stamp, this.spec.origin),
            new Stamp(this.spec.method, this.spec.time)
        ]);
        return new Op(spec, this.value);
    }

    unoverstamped () {

    }

}

Op.NON_SPECIFIC_NOOP = new Op(Spec.NON_SPECIFIC_NOOP, "");
Op.SERIALIZATION_MODES = {
    LINE_BASED: 1,
    EXPLICIT: 2,
    EXPLICIT_ONLY: 3
};
Op.rsOp = '\\n*(' + Spec.rsSpec.replace(/\((\?\:)?/g, '(?:') + ')' +
    '(?:(\\n)|[ \\t](.*)\\n|=$((?:\\n[ \\t].*)*)|=('+Base64x64.rs64x64+')\\n)';
Op.reOp = new RegExp(Op.rsOp, "mg");
Op.METHOD_ON = "on";
Op.METHOD_OFF = "off";
Op.METHOD_STATE = Base64x64.INFINITY;
Op.METHOD_NOOP = Base64x64.ZERO;
Op.METHOD_ERROR = Base64x64.INCORRECT;
Op.PSEUDO_OP_NAMES = [Op.METHOD_ON, Op.METHOD_OFF, Op.METHOD_ERROR, Op.METHOD_NOOP];
Op.STAMP_ON = new Stamp(Op.METHOD_ON);
Op.STAMP_OFF = new Stamp(Op.METHOD_OFF);
Op.STAMP_STATE = new Stamp(Op.METHOD_STATE);
Op.STAMP_NOOP = new Stamp(Op.METHOD_NOOP);
Op.STAMP_ERROR = new Stamp(Op.METHOD_ERROR);
Op.NOTHING = new Op(new Spec(), '');

module.exports = Op;
