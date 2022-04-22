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
define('imageSelectorTranslationKeys', [], [
  'modal.title',
  'modal.loadFail.message',
  'modal.selectButton',
  'modal.fileUpload.success',
  'modal.fileUpload.fail',
  'modal.fileUpload.abort',
  'modal.initialization.fail'
]);


define('imageSelector', ['jquery', 'modal', 'resource', 'l10n!imageSelector'],
  function($, $modal, resource, translations) {
    'use strict';

    function getEntityReference(referenceStr) {
      var reference;
      if (referenceStr.startsWith("attachment:")) {
        var separatorIndex = referenceStr.indexOf(':');
        reference = referenceStr.substr(separatorIndex + 1);
      } else {
        reference = referenceStr;
      }

      return XWiki.Model.resolve(reference, XWiki.EntityType.ATTACHMENT);
    }

    /**
     * Can be called by the image selector tab UIXs. Indicates that an image has been selected.
     *
     * @param imageReference the selected image reference
     */
    function saveSelectedImageReference(imageReference) {
      modal.data('imageReference', {
        value: resource.convertEntityReferenceToResourceReference(getEntityReference(imageReference))
      });
      $('.image-selector-modal button.btn-primary').prop('disabled', false);
    }

    /**
     * Can be called by the images selector tab UIXs. Indicated that no image is selected.
     */
    function removeSelectedImageReference() {
      modal.data('imageReference', {});
      $('.image-selector-modal button.btn-primary').prop('disabled', true);
    }

    function initialize(modal) {
      if (!modal.data('initialized')) {
        var url = new XWiki.Document(XWiki.Model.resolve('CKEditor.ImageSelectorService', XWiki.EntityType.DOCUMENT))
          .getURL('get');
        $.get(url, $.param({language: $('html').attr('lang')}))
          .done(function(html, textState, jqXHR) {
            var imageSelector = $('.image-selector');
            var requiredSkinExtensions = jqXHR.getResponseHeader('X-XWIKI-HTML-HEAD');
            $(document).loadRequiredSkinExtensions(requiredSkinExtensions);
            imageSelector.html(html);
            imageSelector.removeClass('loading');

            modal.data('initialized', true);
          }).fail(function(error) {
          console.log('Failed to retrieve the image selection form.', error);
          new XWiki.widgets.Notification(translations.get('modal.initialization.fail'), 'error');
          modal.data('initialized', true);
        });
      }
    }

    function getEditor() {
      return modal.data('input').editor;
    }

    // Defined once the modal is initialized.
    var modal;

    // Initialize the modal.
    var createModal = $modal.createModalStep({
      'class': 'image-selector-modal',
      title: translations.get('modal.title'),
      acceptLabel: translations.get('modal.selectButton'),
      content: '<div class="image-selector loading"></div>',
      onLoad: function() {
        modal = this;
        var selectButton = modal.find('.modal-footer .btn-primary');
        // Make the modal larger.
        modal.find('.modal-dialog').addClass('modal-lg');

        modal.on('shown.bs.modal', function() {
          initialize(modal);
        });
        selectButton.on('click', function() {
          var imageData = modal.data('input').imageData || {};
          imageData.resourceReference = modal.data('imageReference').value;
          if (imageData.resourceReference) {
            imageData.resourceReference.typed = false;
          }
          var output = {
            imageData: imageData,
            editor: modal.data('input').editor,
            newImage: modal.data('input').newImage
          };
          modal.data('output', output).modal('hide');
        });
      }
    });
    return {
      createModal: createModal,
      saveSelectedImageReference: saveSelectedImageReference,
      removeSelectedImageReference: removeSelectedImageReference,
      getEditor: getEditor
    };
  });
