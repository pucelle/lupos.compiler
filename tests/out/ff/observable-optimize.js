import { Observed, trackGet, trackSet } from '@pucelle/ff';
import { Component } from '@pucelle/lupos.js';
class TestOptimizing extends Component {
    prop = { value: 1 };
    eliminateChildProp() {
        this.prop;
        if (true) {
            this.prop;
            trackGet(this, "prop");
        }
        trackGet(this, "prop");
        return '';
    }
    eliminateChildVariable() {
        let prop = { value: 1 };
        prop.value;
        if (true) {
            prop.value;
            trackGet(prop, "value");
        }
        trackGet(prop, "value");
        return '';
    }
    avoidEliminatingSameNameButDifferentVariable() {
        let prop = { value: 1 };
        prop.value;
        if (true) {
            let prop = { value: 2 };
            prop.value;
            trackGet(prop, "value");
        }
        trackGet(prop, "value");
        return '';
    }
    moveConditionalConditionForward() {
        if ((trackGet(this, "prop"), this.prop)) { }
        return '';
    }
    moveIterationInitializerForward() {
        let i = this.prop.value;
        for ((trackGet(this, "prop"), trackGet(this.prop, "value")); i < 1; i++) { }
        return '';
    }
    moveIterationConditionForward() {
        for (let i = 0; (trackGet(this, "prop"), trackGet(this.prop, "value"), i < this.prop.value); i++) { }
        return '';
    }
    moveIterationIncreasementForward() {
        for (let i = 0; i < 1; (trackGet(this, "prop"), trackGet(this.prop, "value"), i += this.prop.value)) { }
        return '';
    }
    moveForIterationContentTrackingOuter() {
        for (let i = 0; i < 1; i++) {
            this.prop.value;
            trackGet(this, "prop");
            trackGet(this.prop, "value");
        }
        return '';
    }
    moveWhileIterationContentTrackingOuter() {
        let index = 0;
        while (index < 1) {
            this.prop.value;
            trackGet(this, "prop");
            trackGet(this.prop, "value");
        }
        return '';
    }
    preventMovingIterationContentWhenIncludesLocalVariables() {
        let prop = [this.prop, this.prop];
        for (let i = 0; i < 1; i++) {
            prop[i].value;
            trackGet(prop, "");
            trackGet(prop[i], "value");
        }
        trackGet(this, "prop");
        return '';
    }
}
class TestMutable extends Component {
    prop = [{ value: 1 }, { value: 2 }];
    dynamicVariableAsIndex() {
        let index = 0;
        this.prop[index].value;
        index++;
        this.prop[index].value;
        trackGet(this, "prop");
        trackGet(this.prop, "");
        trackGet(this.prop[index], "value");
        return '';
    }
    dynamicIndexChangeOtherWhere() {
        let index = { value: 0 };
        this.prop[index.value].value;
        index.value++;
        this.prop[index.value].value;
        trackGet(this, "prop");
        trackGet(this.prop, "");
        trackGet(this.prop[index.value], "value");
        return '';
    }
    dynamicExp() {
        let a = this.prop[0];
        a.value = 1;
        a = this.prop[1];
        a.value = 2;
        trackSet(a, "value");
    }
    dynamicExpAndIndexParam() {
        let index = 0;
        let a = this.getItem(index++);
        a.value = 1;
        a = this.getItem(index++);
        a.value = 2;
        trackSet(a, "value");
    }
    getItem(index) {
        trackGet(this, "prop");
        trackGet(this.prop, "");
        return this.prop[index];
    }
}
