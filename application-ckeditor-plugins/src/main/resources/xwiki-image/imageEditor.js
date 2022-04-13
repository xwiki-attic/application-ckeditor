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

define('imageEditorTranslationKeys', [], [
  'modal.backToEditor.button',
  'modal.loadFail.message',
  'modal.title',
  'modal.insertButton'
]);

define('imageStyleClient', ['jquery'], function($) {
  'use strict';
  var cachedResultDefault;
  var cachedResult;

  var restURL = XWiki.contextPath + "/rest/wikis/" + XWiki.currentWiki + "/imageStyles";

  // Load the styles once and use a cached version if the styles are requested again.
  function loadImageStylesDefault() {
    if (cachedResultDefault === undefined) {

      return $.getJSON(restURL + "/default",
        $.param({'documentReference': XWiki.Model.serialize(XWiki.currentDocument.documentReference)}))
        .then(function(defaultStyle) {
          cachedResultDefault = defaultStyle;
          return defaultStyle;
        });
    } else {
      return Promise.resolve(cachedResultDefault);
    }
  }

  function loadImageStyles() {
    if (cachedResult === undefined) {
      return $.getJSON(restURL,
        $.param({'documentReference': XWiki.Model.serialize(XWiki.currentDocument.documentReference)}))
        .then(function(defaultStyles) {
          cachedResult = defaultStyles;
          return defaultStyles;
        });
    } else {
      return Promise.resolve(cachedResult);
    }
  }

  return {
    loadImageStyles: loadImageStyles,
    loadImageStylesDefault: loadImageStylesDefault
  };
});

// TODO: xwiki-skinx is a macro selector specific module, it needs to be moved somewhere common.
define('imageEditor', ['jquery', 'modal', 'imageStyleClient', 'l10n!imageEditor', 'xwiki-skinx'],
  function($, $modal, imageStyleClient, translations) {
    'use strict';

    function initImageStyleField(modal) {
      return new Promise(function(resolve, reject) {
        var imageStylesField = $('#imageStyles');
        if (imageStylesField) {
          imageStyleClient.loadImageStylesDefault()
            .then(function(defaultStyle) {
              var settings = {
                preload: true,
                onChange: function(value) {
                  updateAdvancedFromStyle(value, modal);
                },
                load: function(typedText, callback) {
                  imageStyleClient.loadImageStyles().then(function(values) {
                    var imageStyles = values.imageStyles.map(function(value) {
                      return {
                        label: value.prettyName,
                        value: value.type
                      };
                    });
                    imageStyles.unshift({label: '---', value: ''});
                    callback(imageStyles);
                    // Sets the default value once the values are loaded.
                    imageStylesField.data('selectize').addItem(defaultStyle.defaultStyle || '');
                    resolve(values.imageStyles);
                  }, function(err) {
                    reject(err);
                  });
                }
              };

              imageStylesField.xwikiSelectize(settings);
            }, function(err) {
              reject(err);
            });
        } else {
          resolve();
        }
      });
    }

    // TODO: Add support for editing the caption directly from the dialog (see CKEDITOR-435)
    function initCaptionField() {
      var activation = $('#imageCaptionActivation');
      if (activation) {
        activation.change(function() {
          $("#imageCaption").prop('disabled', !this.checked);
        });
      }
    }

    function addChangeImageButton(insertButton, modal) {
      var selectImageButton = $('<button type="button" class="btn btn-default pull-left"></button>')
        .text(translations.get('modal.backToEditor.button'))
        .prependTo(insertButton.parent());
      selectImageButton.on('click', function() {
        var macroData = getFormData(modal);
        modal.data('output', {
          action: 'selectImage',
          editor: modal.data('input').editor,
          macroData: macroData
        }).modal('hide');
      });
    }

    // Fetch modal content from a remote template the first time the image dialog editor is opened.
    function initialize(modal) {
      var params = modal.data('input');
      if (!modal.data('initialized')) {
        var url = new XWiki.Document(XWiki.Model.resolve('CKEditor.ImageEditorService', XWiki.EntityType.DOCUMENT))
          .getURL('get');
        $.get(url, $.param({
          language: $('html').attr('lang'),
          isHTML5: $(params.editor.document).data('syntax') !== 'annotatedxhtml/1.0'
        }))
          .done(function(html, textState, jqXHR) {
            var imageEditor = $('.image-editor');
            var requiredSkinExtensions = jqXHR.getResponseHeader('X-XWIKI-HTML-HEAD');
            $(params.editor.document.$).loadRequiredSkinExtensions(requiredSkinExtensions);
            imageEditor.html(html);
            // TODO: Add support for editing the caption directly from the dialog (see CKEDITOR-435)
            // initCaptionField();
            initImageStyleField(modal).then(function() {
              imageEditor.removeClass('loading');
              $('.image-editor-modal button.btn-primary').prop('disabled', false);
              updateForm(modal);
              modal.data('initialized', true);
            });


          }).fail(function(error) {
          console.log('Failed to retrieve the image edition form.', error);
        });
      } else {
        updateForm(modal);
      }
    }

    function getFormData(modal) {
      var resourceReference = modal.data('input').macroData.resourceReference;
      return {
        resourceReference: resourceReference,
        imageStyle: $('#imageStyles').val(),
        alignment: $('#advanced [name="alignment"]:checked').val(),
        border: $('#advanced [name="imageBorder"]').is(':checked'),
        textWrap: $('#advanced [name="textWrap"]').is(':checked'),
        alt: $('#altText').val(),
        hasCaption: $("#imageCaptionActivation").is(':checked'),
        // TODO: Add support for editing the caption directly from the dialog (see CKEDITOR-435)
        //imageCaption: $("#imageCaption").val(), 
        width: $("#imageWidth").val(),
        height: $("#imageHeight").val(),
        src: CKEDITOR.plugins.xwikiResource.getResourceURL(resourceReference, modal.data('input').editor)
      };
    }

    function filterImageStyles(imageStylesConfig, imageStyle) {
      var i = 0;
      for (i; i < imageStylesConfig.length; i++) {
        var imageStyleConfig = imageStylesConfig[i];
        if (imageStyleConfig.type === imageStyle) {
          return imageStyleConfig;
        }
      }
      return undefined;
    }

    function updateAdvancedFromStyle(imageStyle, modal) {
      function updateImageSize(config, noStyle, overrideValues) {
        var adjustableSize = config.adjustableSize !== false;
        var imageWidth = $('#imageWidth');
        var imageHeight = $('#imageHeight');
        imageWidth.prop("disabled", !adjustableSize && !noStyle);
        imageHeight.prop("disabled", !adjustableSize && !noStyle);
        if (overrideValues) {
          imageWidth.val(config.defaultWidth);
          imageHeight.val(config.defaultHeight);
        }
      }

      function updateBorder(config, noStyle, overrideValues) {
        var imageBorder = $('#imageBorder');
        imageBorder.prop('disabled', !config.adjustableBorder && !noStyle);
        if (overrideValues) {
          imageBorder.prop('checked', config.defaultBorder);
        }
      }

      function updateAlignment(config, noStyle, overrideValues) {
        var alignment = $('#advanced [name="alignment"]');
        alignment.prop('disabled', !config.adjustableAlignment && !noStyle);
        if (overrideValues) {
          alignment.val([config.defaultAlignment || 'none']);
        }
      }

      function updateTextWrap(config, noStyle, overrideValues) {
        var textWrap = $('#advanced [name="textWrap"]');
        textWrap.prop('disabled', !config.adjustableTextWrap && !noStyle);
        if (overrideValues) {
          textWrap.prop('checked', config.defaultTextWrap);
        }
      }

      imageStyleClient.loadImageStyles().then(function(imageStylesConfig) {
        // Do not update the form if the current style is the same are the one of the current user.
        var overrideValues = modal.data('input').macroData === undefined ||
          modal.data('input').macroData.imageStyle !== imageStyle;

        modal.data('input').macroData = modal.data('input').macroData || {};
        modal.data('input').macroData.imageStyle = imageStyle;

        var config = filterImageStyles(imageStylesConfig.imageStyles, imageStyle);
        var noStyle = false;
        if (config === undefined) {
          config = {};
          noStyle = true;
          overrideValues = false;
        }

        // Image size
        updateImageSize(config, noStyle, overrideValues);

        // Border
        updateBorder(config, noStyle, overrideValues);

        // Alignment
        updateAlignment(config, noStyle, overrideValues);

        // Text Wrap
        updateTextWrap(config, noStyle, overrideValues);
      });
    }

    // Update the form according to the modal input data.
    // 
    function updateForm(modal) {
      var macroData = modal.data('input').macroData || {};

      // Switch back to the default tab
      $('.image-editor a[href="#standard"]').tab('show');

      // Style
      if (macroData.imageStyle) {
        $('#imageStyles')[0].selectize.setValue(macroData.imageStyle);
      }

      // Alt
      $('#altText').val(macroData.alt);


      // Caption
      $('#imageCaptionActivation').prop('checked', macroData.hasCaption);
      // TODO: Add support for editing the caption directly from the dialog (see CKEDITOR-435)
      /*
      var imageCaption = $('#imageCaption');
      if (macroData.hasCaption) {
        imageCaption.val(macroData.imageCaption);
        imageCaption.prop('disabled', false);
      } else {
        imageCaption.val('');
        imageCaption.prop('disabled', true);
      }
      */

      // Image size
      $('#imageWidth').val(macroData.width);
      $('#imageHeight').val(macroData.height);

      // Border
      $('#imageBorder').prop('checked', macroData.border);

      // Alignment
      $('#advanced [name="alignment"]').val([macroData.alignment]);

      // Text Wrap
      $('#advanced [name="textWrap"]').prop('checked', macroData.textWrap);

      // Override with the style values only of it's an new image
      updateAdvancedFromStyle($('#imageStyles')[0].selectize.getValue(), modal);
    }

    return $modal.createModalStep({
      'class': 'image-editor-modal',
      title: translations.get('modal.title'),
      acceptLabel: translations.get('modal.insertButton'),
      content: '<div class="image-editor loading"></div>',
      onLoad: function() {
        var modal = this;
        var insertButton = modal.find('.modal-footer .btn-primary');
        // Make the modal larger.
        modal.find('.modal-dialog').addClass('modal-lg');

        modal.on('shown.bs.modal', function() {
          initialize(modal);
        });
        insertButton.on('click', function() {
          var output = getFormData(modal);
          modal.data('output', output).modal('hide');
        });

        addChangeImageButton(insertButton, modal);
      }
    });
  });
