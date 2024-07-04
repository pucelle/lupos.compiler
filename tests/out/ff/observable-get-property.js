import { Observed, trackGet } from '@pucelle/ff';
import { Component } from '@pucelle/lupos.js';
class TestNormalProp extends Component {
    prop = 'Text';
    getProp() {
        trackGet(this, "prop");
        return this.prop;
    }
}
class TestElementProp extends Component {
    prop = 'Text';
    getProp() {
        let prop = 'prop';
        trackGet(this, 'prop', prop);
        return this['prop']
            + this[prop];
    }
}
class TestObjectProp extends Component {
    prop = { value: 'Text' };
    getProp() {
        trackGet(this, "prop");
        trackGet(this.prop, "value");
        return this.prop.value;
    }
}
class TestRepetitiveProp extends Component {
    prop = { value: 'Text' };
    getProp() {
        trackGet(this, "prop");
        trackGet(this.prop, "value");
        return this.prop.value
            + this.prop.value
            + this.prop["value"]
            + this.prop['value'];
    }
}
class TestGroupedProp extends Component {
    prop1 = { value1: 'Text', value2: 'Text' };
    prop2 = { value: 'Text' };
    getProp() {
        trackGet(this, "prop1", "prop2");
        trackGet(this.prop1, "value1", "value2");
        trackGet(this.prop2, "value");
        return this.prop1.value1
            + this.prop1.value2
            + this.prop2.value;
    }
}
class TestQuestionDotPropMerge extends Component {
    prop = undefined;
    getProp() {
        trackGet(this, "prop");
        this.prop && trackGet(this.prop, "value");
        return '' + this.prop?.value
            + this.prop?.['value'];
    }
}
