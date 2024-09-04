import { Component, html, CompiledTemplateResult, TemplateMaker, SlotPosition, HTMLMaker, DynamicComponentBlock, TemplateSlot } from '@pucelle/lupos.js';
import { trackGet } from "@pucelle/ff";
const $html_0 = new HTMLMaker("<div></div>");
/*
<root>
    <Com1 .comProp=${1} />
</root>
*/ const $template_0 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    let $com_0 = new Com1($node_0);
    $com_0.comProp = 1;
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        parts: [$com_0]
    };
});
const $html_1 = new HTMLMaker("<!----><div></div><!---->");
/*
<root>
    <${this.UnionedCom} .comProp=$LUPOS_SLOT_INDEX_1$ />
</root>
*/ const $template_1 = new TemplateMaker($context => {
    let $com_0;
    let $node = $html_1.make();
    let $node_0 = $node.content.firstChild;
    let $node_1 = $node.content.lastChild;
    let $block_0 = new DynamicComponentBlock(function (com) {
        $com_0 = com;
        $com_0.comProp = 1;
    }, new TemplateSlot(new SlotPosition(2, $node_1), $context));
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        update($values) {
            $block_0.update($values[0]);
        },
        parts: () => [$com_0]
    };
});
/*
<root>
    <${this.ConstructedCom} .comProp=$LUPOS_SLOT_INDEX_1$ />
</root>
*/ const $template_2 = new TemplateMaker($context => {
    let $com_0;
    let $node = $html_1.make();
    let $node_0 = $node.content.firstChild;
    let $node_1 = $node.content.lastChild;
    let $block_0 = new DynamicComponentBlock(function (com) {
        $com_0 = com;
        $com_0.comProp = 1;
    }, new TemplateSlot(new SlotPosition(2, $node_1), $context));
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        update($values) {
            $block_0.update($values[0]);
        },
        parts: () => [$com_0]
    };
});
/*
<root>
    <Com1 ..forceComProp=${1} />
</root>
*/ const $template_3 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    let $com_0 = new Com1($node_0);
    $com_0.forceComProp = 1;
    return {
        el: $node,
        position: new SlotPosition(2, $node_0),
        parts: [$com_0]
    };
});
/*
<root>
    <div .elProp=${1} />
</root>
*/ const $template_4 = new TemplateMaker($context => {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    $node_0.elProp = 1;
    return {
        el: $node,
        position: new SlotPosition(2, $node_0)
    };
});
class TestProperty extends Component {
    UnionedCom = Com1;
    ConstructedCom = Com1;
    testComponentProperty() {
        return new CompiledTemplateResult($template_0, []);
    }
    testUnionedDynamicComponentProperty() {
        trackGet(this, "UnionedCom");
        return new CompiledTemplateResult($template_1, [this.UnionedCom]);
    }
    testConstructedDynamicComponentProperty() {
        trackGet(this, "ConstructedCom");
        return new CompiledTemplateResult($template_2, [this.ConstructedCom]);
    }
    testForceComponentProperty() {
        return new CompiledTemplateResult($template_3, []);
    }
    testElementProperty() {
        return new CompiledTemplateResult($template_4, []);
    }
}
class Com1 extends Component {
    comProp = 1;
}
class Com2 extends Component {
    comProp = 1;
}