import { Observed, trackGet } from '@pucelle/ff';
import { Component } from '@pucelle/lupos.js';
class TestObservedVariableType {
    variables() {
        var a = { value: 1 };
        var b = { value: 1 };
        var c = b;
        trackGet(a, "value");
        trackGet(b, "value");
        trackGet(c, "value");
        return a.value
            + b.value
            + c.value;
    }
}
class TestObservedParameter {
    prop = { value: 1 };
    parameterAs(a = { value: 1 }) {
        trackGet(a, "value");
        return a.value;
    }
    parameterType(a) {
        trackGet(a, "value");
        return a.value;
    }
    parameterThis() {
        trackGet(this, "prop");
        trackGet(this.prop, "value");
        return this.prop.value;
    }
}
class TestObservedPropertyAtUnobserved {
    prop = { value: 1 };
    unObservedProp = { value: 1 };
    getPropValue() {
        trackGet(this, "prop");
        trackGet(this.prop, "value");
        return this.prop.value;
    }
    getAsProp() {
        trackGet(this.unObservedProp, "value");
        return this.unObservedProp.value;
    }
}
class TestObservedProperty extends Component {
    prop = { value: 1 };
    getPropValueUseMethod() {
        trackGet(this, "prop");
        return this.getPropValue(this.prop);
    }
    getPropValue(prop) {
        trackGet(prop, "value");
        return prop.value;
    }
    expressionDistinct() {
        trackGet(this, "prop");
        trackGet(this.prop, "value");
        return this.prop.value + this.prop.value;
    }
}
class TestArrayMapObservedParameter {
    prop = [{ value: 1 }];
    arrowFnImplicitReturn() {
        return this.prop.map((v) => { trackGet(v, "value"); return v.value; }).join('');
    }
    arrowFnBlockBody() {
        return this.prop.map((v) => { trackGet(v, "value"); return v.value; }).join('');
    }
    normalFn() {
        return this.prop.map(function (v) { trackGet(v, "value"); return v.value; }).join('');
    }
}
class TestMethodReturnedType extends Component {
    prop = { value: 'Text' };
    getValueUseMethod() {
        var item = this.getNormalItem();
        trackGet(item, "value");
        return item.value;
    }
    getValueUseMethodSingleExp() {
        var _ref_0;
        _ref_0 = this.getNormalItem();
        trackGet(_ref_0, "value");
        return _ref_0.value;
    }
    getNormalItem() {
        trackGet(this, "prop");
        return this.prop;
    }
    getValueUseObservedMethod() {
        var item = this.getObservedItem();
        trackGet(item, "value");
        return item.value;
    }
    getValueUseObservedMethodSingleExp() {
        var _ref_0;
        _ref_0 = this.getObservedItem();
        trackGet(_ref_0, "value");
        return _ref_0.value;
    }
    getObservedItem() {
        trackGet(this, "prop");
        return this.prop;
    }
    getValueUseObservedInstance() {
        var _ref_0;
        _ref_0 = this.getInstance();
        trackGet(_ref_0, "prop");
        trackGet(_ref_0.prop, "value");
        return _ref_0.prop.value;
    }
    getInstance() {
        return this;
    }
}
