import { Component, CompiledTemplateResult, TemplateMaker, SlotPosition, HTMLMaker, ClassBinding } from '@pucelle/lupos.js';
import { trackGet } from "@pucelle/ff";
const $html_0 = new HTMLMaker("<div></div>");
/*
<root>
    <div class="${this.className} className2" />
</root>
*/ const $template_0 = new TemplateMaker(function () {
    let $latest_0;
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    return {
        el: $node,
        position: new SlotPosition(1, $node_0),
        update($values) {
            if ($latest_0 !== $values[0]) {
                $node_0.setAttribute("class", $values[0] + " className2");
                $latest_0 = $values[0];
            }
        }
    };
});
/*
<root>
    <div class=${this.className} />
</root>
*/ const $template_1 = new TemplateMaker(function () {
    let $latest_0;
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    return {
        el: $node,
        position: new SlotPosition(1, $node_0),
        update($values) {
            if ($latest_0 !== $values[0]) {
                $node_0.setAttribute("class", $values[0]);
                $latest_0 = $values[0];
            }
        }
    };
});
/*
<root>
    <div class=${this.nullableClassName} />
</root>
*/ const $template_2 = new TemplateMaker(function () {
    let $latest_0;
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    return {
        el: $node,
        position: new SlotPosition(1, $node_0),
        update($values) {
            if ($latest_0 !== $values[0]) {
                $values[0] === null ? $node_0.removeAttribute("class") : $node_0.setAttribute("class", $values[0]);
                $latest_0 = $values[0];
            }
        }
    };
});
/*
<root>
    <Com class="className" />
</root>
*/ const $template_3 = new TemplateMaker(function () {
    let $node = $html_0.make();
    let $node_0 = $node.content.firstChild;
    let $com_0 = new Com({}, $node_0);
    $node_0.classList.add("className");
    return {
        el: $node,
        position: new SlotPosition(1, $node_0),
        parts: [
            [$com_0, 1]
        ]
    };
});
const $html_4 = new HTMLMaker("<!---->");
/*
<root>
    <template class="classNameSelf" :class=${this.dynamicClassName} />
</root>
*/ const $template_4 = new TemplateMaker(function ($context) {
    let $latest_0;
    let $node = $html_4.make();
    let $node_0 = $context.el;
    let $node_1 = $node.content.firstChild;
    let $binding_0 = new ClassBinding($node_0);
    $node_0.classList.add("classNameSelf");
    return {
        el: $node,
        position: new SlotPosition(1, $node_1),
        update($values) {
            if ($latest_0 !== $values[0]) {
                $binding_0.updateString($values[0]);
                $latest_0 = $values[0];
            }
        }
    };
});
class TestAttribute extends Component {
    className = 'className';
    booleanValue = true;
    nullableClassName;
    testInterpolatedString() {
        trackGet(this, "className");
        return new CompiledTemplateResult($template_0, [
            this.className
        ]);
    }
    testString() {
        trackGet(this, "className");
        return new CompiledTemplateResult($template_1, [
            this.className
        ]);
    }
    testNullableAttr() {
        trackGet(this, "nullableClassName");
        return new CompiledTemplateResult($template_2, [
            this.nullableClassName
        ]);
    }
    testComponentClass() {
        return new CompiledTemplateResult($template_3, []);
    }
}
class Com extends Component {
    static SlotContentType = 0;
    dynamicClassName = '';
    render() {
        trackGet(this, "dynamicClassName");
        return new CompiledTemplateResult($template_4, [
            this.dynamicClassName
        ]);
    }
}
