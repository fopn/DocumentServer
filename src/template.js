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

/* global _ */

import axios from '@nextcloud/axios'

/**
 * @param {object} OC Nextcloud OCA object
 */
(function(OC) {

	OCA.Eurooffice = Object.assign({
		AppName: 'eurooffice',
		templates: null,
	}, OCA.Eurooffice)

	OCA.Eurooffice.OpenTemplatePicker = function(name, extension, type) {

		const existingPicker = document.getElementById('eurooffice-template-picker')
		if (existingPicker) {
			existingPicker.remove()
		}

		axios.get(OC.filePath(OCA.Eurooffice.AppName, 'templates', 'templatePicker.html'))
			.then((response) => {
				const tempDiv = document.createElement('div')
				tempDiv.innerHTML = response.data
				const dialog = window.$(tempDiv.firstElementChild).octemplate({
					dialog_name: 'eurooffice-template-picker',
					dialog_title: t(OCA.Eurooffice.AppName, 'Select template'),
				})

				OCA.Eurooffice.AttachTemplates(dialog, type)

				document.body.appendChild(dialog[0])

				window.$('#eurooffice-template-picker').ocdialog({
					closeOnEscape: true,
					modal: true,
					buttons: [{
						text: t('core', 'Cancel'),
						classes: 'cancel',
						click() {
							window.$(this).ocdialog('close')
						},
					}, {
						text: t(OCA.Eurooffice.AppName, 'Create'),
						classes: 'primary',
						click() {
							const templateId = this.dataset.templateId
							const fileList = OCA.Files.App.fileList
							OCA.Eurooffice.CreateFile(name + extension, fileList, templateId)
							window.$(this).ocdialog('close')
						},
					}],
				})
			})
	}

	OCA.Eurooffice.GetTemplates = function() {
		if (OCA.Eurooffice.templates != null) {
			return
		}

		axios.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/template'))
			.then((response) => {
				const data = response.data
				if (data.error) {
					OC.Notification.show(data.error, {
						type: 'error',
						timeout: 3,
					})
					return
				}

				OCA.Eurooffice.templates = data
			})
	}

	OCA.Eurooffice.AddTemplate = function(file, callback) {
		const data = new FormData()
		data.append('file', file)

		axios.post(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/template'), data)
			.then((response) => {
				const data = response.data
				if (data.error) {
					callback(null, data.error)
					return
				}

				callback(data, null)
			})
			.catch((error) => {
				callback(null, error.message || 'Failed to add template')
			})
	}

	OCA.Eurooffice.DeleteTemplate = function(templateId, callback) {
		axios.delete(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/template?templateId={templateId}',
			{
				templateId,
			}))
			.then((response) => {
				if (response.data) {
					callback(response.data)
				}
			})
	}

	OCA.Eurooffice.AttachTemplates = function(dialog, type) {
		const emptyItem = dialog[0].querySelector('.eurooffice-template-item')

		OCA.Eurooffice.templates.forEach(template => {
			if (template.type !== type) {
				return
			}
			const item = emptyItem.cloneNode(true)

			const label = item.querySelector('label')
			if (label) {
				label.setAttribute('for', 'template_picker-' + template.id)
			}
			const input = item.querySelector('input')
			if (input) {
				input.id = 'template_picker-' + template.id
			}
			const img = item.querySelector('img')
			if (img) {
				img.src = template.icon
			}
			const p = item.querySelector('p')
			if (p) {
				p.textContent = template.name
			}
			item.onclick = function() {
				dialog[0].dataset.templateId = template.id
			}
			dialog[0].querySelector('.eurooffice-template-container').appendChild(item)
		})

		const emptyLabel = emptyItem.querySelector('label')
		if (emptyLabel) {
			emptyLabel.setAttribute('for', 'template_picker-0')
		}
		const emptyInput = emptyItem.querySelector('input')
		if (emptyInput) {
			emptyInput.id = 'template_picker-0'
			emptyInput.checked = true
		}
		const emptyImg = emptyItem.querySelector('img')
		if (emptyImg) {
			emptyImg.src = OC.generateUrl('/core/img/filetypes/x-office-' + type + '.svg')
		}
		const emptyP = emptyItem.querySelector('p')
		if (emptyP) {
			emptyP.textContent = t(OCA.Eurooffice.AppName, 'Empty')
		}
		emptyItem.onclick = function() {
			dialog[0].dataset.templateId = '0'
		}
	}

	OCA.Eurooffice.AttachItemTemplate = function(template) {
		axios.get(OC.filePath(OCA.Eurooffice.AppName, 'templates', 'templateItem.html'))
			.then((response) => {
				const tempDiv = document.createElement('div')
				tempDiv.innerHTML = response.data
				const item = tempDiv.firstElementChild

				item.setAttribute('data-id', template.id)
				const img = item.querySelector('img')
				if (img) {
					img.setAttribute('src', template.icon)
				}
				const p = item.querySelector('p')
				if (p) {
					p.textContent = template.name
				}

				const container = document.querySelector('.eurooffice-template-container')
				if (container) {
					container.appendChild(item)
				}
			})
	}

	OCA.Eurooffice.TemplateExist = function(type) {
		const isExist = OCA.Eurooffice.templates.some((template) => {
			return template.type === type
		})

		return isExist
	}

})(OC)
