import { Component } from '@pucelle/lupos.js';
import { trackGet } from "@pucelle/ff";
class TestIfStatement extends Component {
    prop1 = 0;
    prop2 = 0;
    testIf() {
        if (this.prop1)
            this.prop1;
        else {
            trackGet(this, "prop2");
            if (this.prop2)
                this.prop2;
            else
                0;
        }
        trackGet(this, "prop1");
        return 0;
    }
    testIfReturned() {
        trackGet(this, "prop1");
        if (this.prop1)
            return this.prop1;
        else {
            trackGet(this, "prop2");
            if (this.prop2)
                return this.prop2;
            else
                return 0;
        }
    }
}
class TestSwitchBlock extends Component {
    cond = '1';
    prop = 'Text';
    fixedCond() {
        let cond = '1';
        trackGet(this, "prop");
        switch (cond) {
            case '1': return this.prop;
            case '2': return this.prop;
        }
        return 0;
    }
    variableCond() {
        trackGet(this, "cond", "prop");
        switch (this.cond) {
            case '1': return this.prop;
            case '2': return this.prop;
        }
        return 0;
    }
}
class TestForBlock extends Component {
    prop = 1;
    testFor() {
        for (let i = 0; i < 10; i++)
            this.prop;
        trackGet(this, "prop");
        return 0;
    }
    testForInitializer() {
        let i = this.prop;
        for (; i < 1; i++) {
            this.prop;
        }
        trackGet(this, "prop");
        return 0;
    }
    testForCondition() {
        for (let i = 0; i < this.prop; i++) {
            this.prop;
        }
        trackGet(this, "prop");
        return 0;
    }
    testForIncreasement() {
        for (let i = 0; i < this.prop; i++) {
            this.prop;
        }
        trackGet(this, "prop");
        return 0;
    }
}
class TestWhileBlock extends Component {
    prop = 1;
    testWhile() {
        let i = 0;
        while (i < 10)
            this.prop;
        trackGet(this, "prop");
        return 0;
    }
}
class TestDoWhileBlock extends Component {
    prop = 1;
    testDoWhile() {
        let i = 0;
        do {
            this.prop;
        } while (i < 10);
        trackGet(this, "prop");
        return 0;
    }
}
class TestBreakStatement extends Component {
    prop1 = 0;
    prop2 = 0;
    testBreak() {
        for (let i = 0; i < 10; i++) {
            if (this.prop1)
                break;
            this.prop2;
            trackGet(this, "prop2");
        }
        trackGet(this, "prop1");
        return 0;
    }
}
class TestContinueStatement extends Component {
    prop1 = 0;
    prop2 = 0;
    testContinue() {
        for (let i = 0; i < 10; i++) {
            if (this.prop1)
                continue;
            this.prop2;
            trackGet(this, "prop2");
        }
        trackGet(this, "prop1");
        return 0;
    }
}
class TestAwaitStatement extends Component {
    prop1 = 1;
    prop2 = 2;
    async testAwait() {
        this.prop1;
        trackGet(this, "prop1");
        await Promise.resolve();
        this.prop2;
        trackGet(this, "prop2");
        return 0;
    }
}
class TestYieldStatement extends Component {
    prop1 = 1;
    prop2 = 2;
    *testYield() {
        this.prop1;
        trackGet(this, "prop1");
        yield 1;
        this.prop2;
        trackGet(this, "prop2");
    }
}
