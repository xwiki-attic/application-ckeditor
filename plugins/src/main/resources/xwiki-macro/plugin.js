/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */
(function() {
  'use strict';
  CKEDITOR.plugins.add('xwiki-macro', {
    requires: 'widget,xwiki-marker',
    init : function(editor) {
      // nodes: CKEDITOR.htmlParser.node[]
      var isInline = function(nodes) {
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (node.type === CKEDITOR.NODE_ELEMENT && !!CKEDITOR.dtd.$block[node.name]) {
            return false;
          }
        }
        return true;
      };

      // startMacroComment: CKEDITOR.htmlParser.comment
      // output: CKEDITOR.htmlParser.node[]
      var wrapMacroOutput = function(startMacroComment, output) {
        var wrapperName = isInline(output) ? 'span' : 'div';
        var wrapper = new CKEDITOR.htmlParser.element(wrapperName, {
          'class': 'macro',
          'data-macro': startMacroComment.value
        });
        for (var i = 0; i < output.length; i++) {
          output[i].remove();
          wrapper.add(output[i]);
        }
        startMacroComment.replaceWith(wrapper);
      };

      editor.plugins['xwiki-marker'].addMarkerHandler(editor, 'macro', {
        toHtml: wrapMacroOutput
      });

      // macroOutputWrapper: CKEDITOR.htmlParser.element
      var unWrapMacroOutput = function(macroOutputWrapper) {
        var startMacroComment = new CKEDITOR.htmlParser.comment(macroOutputWrapper.attributes['data-macro']);
        var stopMacroComment = new CKEDITOR.htmlParser.comment('stopmacro');
        var macro = new CKEDITOR.htmlParser.fragment();
        macro.add(startMacroComment);
        if (editor.config.fullData) {
          macroOutputWrapper.children.forEach(function(child) {
            macro.add(child);
          });
        }
        macro.add(stopMacroComment);
        return macro;
      };      

      // See http://docs.ckeditor.com/#!/api/CKEDITOR.plugins.widget.definition
      editor.widgets.add('xwiki-macro', {
        requiredContent: 'div(macro)[data-macro]; span(macro)[data-macro]',
        upcast: function(element) {
          return (element.name == 'div' || element.name == 'span') &&
            element.hasClass('macro') && element.attributes['data-macro'];
        },
        downcast: unWrapMacroOutput,
        pathName: 'macro'
      });

      var macroPlugin = this;
      editor.widgets.onWidget('xwiki-macro', 'ready', function(event) {
        var macroCall = macroPlugin.parseMacroCall(this.element.getAttribute('data-macro'));
        this.pathName += ':' + macroCall.name;
        // The elementspath plugin takes the path name from the 'data-cke-display-name' attribute which is already set
        // by the widget plugin when this event is fired.
        this.wrapper.data('cke-display-name', this.pathName);
      });
    },

    parseMacroCall: function(startMacroComment) {
      // Unescape the text of the start macro comment.
      var text = CKEDITOR.tools.unescapeComment(startMacroComment);

      // Extract the macro name.
      var separator = '|-|';
      var start = 'startmacro:'.length;
      var end = text.indexOf(separator, start);
      var macroCall = {
        name: text.substring(start, end),
        parameters: {}
      };

      // Extract the macro parameters.
      start = end + separator.length;
      var separatorIndex = CKEDITOR.plugins.xwikiMarker.parseParameters(text, macroCall.parameters,
        start, separator, true);

      // Extract the macro content, if specified.
      if (separatorIndex >= 0) {
        macroCall.content = text.substring(separatorIndex + separator.length);
      }

      return macroCall;
    },

    serializeMacroCall: function(macroCall) {
      var separator = '|-|';
      var output = ['startmacro:', macroCall.name, separator,
        CKEDITOR.plugins.xwikiMarker.serializeParameters(macroCall.parameters)];
      if (typeof macroCall.content === 'string') {
        output.push(separator, macroCall.content);
      }
      return CKEDITOR.tools.escapeComment(output.join(''));
    }
  });
})();