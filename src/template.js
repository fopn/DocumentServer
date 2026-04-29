/**
 *
 * (c) Copyright Ascensio System SIA 2026
 *
 * This program is a free software product.
 * You can redistribute it and/or modify it under the terms of the GNU Affero General Public License
 * (AGPL) version 3 as published by the Free Software Foundation.
 * In accordance with Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * For details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * The interactive user interfaces in modified source and object code versions of the Program
 * must display Appropriate Legal Notices, as required under Section 5 of the GNU AGPL version 3.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as well as technical
 * writing content are licensed under the terms of the Creative Commons Attribution-ShareAlike 4.0 International.
 * See the License terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

/* global _, jQuery */

/**
 * @param {object} $ JQueryStatic object
 * @param {object} OC Nextcloud OCA object
 */
(function($, OC) {

	OCA.Eurooffice = Object.assign({
		AppName: 'eurooffice',
		templates: null,
	}, OCA.Eurooffice)

	OCA.Eurooffice.OpenTemplatePicker = function(name, extension, type) {

		$('#eurooffice-template-picker').remove()

		$.get(OC.filePath(OCA.Eurooffice.AppName, 'templates', 'templatePicker.html'),
			function(tmpl) {
				const $tmpl = $(tmpl)
				const dialog = $tmpl.octemplate({
					dialog_name: 'eurooffice-template-picker',
					dialog_title: t(OCA.Eurooffice.AppName, 'Select template'),
				})

				OCA.Eurooffice.AttachTemplates(dialog, type)

				$('body').append(dialog)

				$('#eurooffice-template-picker').ocdialog({
					closeOnEscape: true,
					modal: true,
					buttons: [{
						text: t('core', 'Cancel'),
						classes: 'cancel',
						click() {
							$(this).ocdialog('close')
						},
					}, {
						text: t(OCA.Eurooffice.AppName, 'Create'),
						classes: 'primary',
						click() {
							const templateId = this.dataset.templateId
							const fileList = OCA.Files.App.fileList
							OCA.Eurooffice.CreateFile(name + extension, fileList, templateId)
							$(this).ocdialog('close')
						},
					}],
				})
			})
	}

	OCA.Eurooffice.GetTemplates = function() {
		if (OCA.Eurooffice.templates != null) {
			return
		}

		$.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/template'),
			function onSuccess(response) {
				if (response.error) {
					OC.Notification.show(response.error, {
						type: 'error',
						timeout: 3,
					})
					return
				}

				OCA.Eurooffice.templates = response

			})
	}

	OCA.Eurooffice.AddTemplate = function(file, callback) {
		const data = new FormData()
		data.append('file', file)

		$.ajax({
			method: 'POST',
			url: OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/template'),
			data,
			processData: false,
			contentType: false,
			success: function onSuccess(response) {
				if (response.error) {
					callback(null, response.error)
					return
				}

				callback(response, null)
			},
		})
	}

	OCA.Eurooffice.DeleteTemplate = function(templateId, callback) {
		$.ajax({
			method: 'DELETE',
			url: OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/template?templateId={templateId}',
				{
					templateId,
				}),
			success: function onSuccess(response) {
				if (response) {
					callback(response)
				}
			},
		})
	}

	OCA.Eurooffice.AttachTemplates = function(dialog, type) {
		const emptyItem = dialog[0].querySelector('.eurooffice-template-item')

		OCA.Eurooffice.templates.forEach(template => {
			if (template.type !== type) {
				return
			}
			const item = emptyItem.cloneNode(true)

			$(item.querySelector('label')).attr('for', 'template_picker-' + template.id)
			item.querySelector('input').id = 'template_picker-' + template.id
			item.querySelector('img').src = template.icon
			item.querySelector('p').textContent = template.name
			item.onclick = function() {
				dialog[0].dataset.templateId = template.id
			}
			dialog[0].querySelector('.eurooffice-template-container').appendChild(item)
		})

		$(emptyItem.querySelector('label')).attr('for', 'template_picker-0')
		emptyItem.querySelector('input').id = 'template_picker-0'
		emptyItem.querySelector('input').checked = true
		emptyItem.querySelector('img').src = OC.generateUrl('/core/img/filetypes/x-office-' + type + '.svg')
		emptyItem.querySelector('p').textContent = t(OCA.Eurooffice.AppName, 'Empty')
		emptyItem.onclick = function() {
			dialog[0].dataset.templateId = '0'
		}
	}

	OCA.Eurooffice.AttachItemTemplate = function(template) {
		$.get(OC.filePath(OCA.Eurooffice.AppName, 'templates', 'templateItem.html'),
			function(item) {
				item = $(item)

				item.attr('data-id', template.id)
				item.children('img').attr('src', template.icon)
				item.children('p').text(template.name)

				$('.eurooffice-template-container').append(item)
			})
	}

	OCA.Eurooffice.TemplateExist = function(type) {
		const isExist = OCA.Eurooffice.templates.some((template) => {
			return template.type === type
		})

		return isExist
	}

})(jQuery, OC)
