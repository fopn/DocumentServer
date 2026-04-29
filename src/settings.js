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

import { spawnDialog } from '@nextcloud/vue/functions/dialog'
import { defineAsyncComponent } from 'vue'

/**
 * @param {object} $ JQueryStatic object
 * @param {object} OC Nextcloud OCA object
 */
(function($, OC) {

	$(document).ready(function() {
		OCA.Eurooffice = Object.assign({}, OCA.Eurooffice)
		if (!OCA.Eurooffice.AppName) {
			OCA.Eurooffice = {
				AppName: 'eurooffice',
			}
		}

		const advToogle = function() {
			$('#euroofficeSecretPanel').toggleClass('eurooffice-hide')
			$('#euroofficeAdv .icon').toggleClass('icon-triangle-s icon-triangle-n')
		}

		if ($('#euroofficeInternalUrl').val().length
			|| $('#euroofficeStorageUrl').val().length
			|| $('#euroofficeJwtHeader').val().length) {
			advToogle()
		}

		$('#euroofficeAdv').click(advToogle)

		$('#euroofficeGroups').prop('checked', $('#euroofficeLimitGroups').val() !== '')

		const groupListToggle = function() {
			if ($('#euroofficeGroups').prop('checked')) {
				OC.Settings.setupGroupsSelect($('#euroofficeLimitGroups'))
			} else {
				$('#euroofficeLimitGroups').select2('destroy')
			}
		}

		$('#euroofficeGroups').click(groupListToggle)
		groupListToggle()

		const demoToggle = function() {
			$('#euroofficeAddrSettings input:not(#euroofficeStorageUrl)').prop('disabled', $('#euroofficeDemo').prop('checked'))
		}

		$('#euroofficeDemo').click(demoToggle)
		demoToggle()

		const watermarkToggle = function() {
			$('#euroofficeWatermarkSettings').toggleClass('eurooffice-hide', !$('#euroofficeWatermark_enabled').prop('checked'))
		}

		$('#euroofficeWatermark_enabled').click(watermarkToggle)

		$('#euroofficeWatermark_shareAll').click(function() {
			$('#euroofficeWatermark_shareRead').parent().toggleClass('eurooffice-hide')
		})

		$('#euroofficeWatermark_linkAll').click(function() {
			$('#euroofficeWatermark_link_sensitive').toggleClass('eurooffice-hide')
		})

		const watermarkGroupLists = [
			'allGroups',
		]

		const watermarkTagLists = [
			'allTags',
			'linkTags',
		]

		const watermarkNodeBehaviour = function(watermark) {
			const watermarkListToggle = function() {
				if ($('#euroofficeWatermark_' + watermark).prop('checked')) {
					if (watermark.indexOf('Group') >= 0) {
						OC.Settings.setupGroupsSelect($('#euroofficeWatermark_' + watermark + 'List'))
					} else {
						$('#euroofficeWatermark_' + watermark + 'List').select2({
							allowClear: true,
							closeOnSelect: false,
							multiple: true,
							separator: '|',
							toggleSelect: true,
							placeholder: t(OCA.Eurooffice.AppName, 'Select tag'),
							query: _.debounce(function(query) {
								query.callback({
									results: OC.SystemTags.collection.filterByName(query.term),
								})
							}, 100, true),
							initSelection(element, callback) {
								const selection = ($(element).val() || []).split('|').map(function(tagId) {
									return OC.SystemTags.collection.get(tagId)
								})
								callback(selection)
							},
							formatResult(tag) {
								return OC.SystemTags.getDescriptiveTag(tag)
							},
							formatSelection(tag) {
								return tag.get('name')
							},
							sortResults(results) {
								results.sort(function(a, b) {
									return OC.Util.naturalSortCompare(a.get('name'), b.get('name'))
								})
								return results
							},
						})
					}
				} else {
					$('#euroofficeWatermark_' + watermark + 'List').select2('destroy')
				}
			}

			$('#euroofficeWatermark_' + watermark).click(watermarkListToggle)
			watermarkListToggle()
		}

		$.each(watermarkGroupLists, function(i, watermarkGroup) {
			watermarkNodeBehaviour(watermarkGroup)
		})

		if (OC.SystemTags && OC.SystemTags.collection) {
			OC.SystemTags.collection.fetch({
				success() {
					$.each(watermarkTagLists, function(i, watermarkTag) {
						watermarkNodeBehaviour(watermarkTag)
					})
				},
			})
		}

		const connectionError = document.getElementById('euroofficeSettingsState').value
		if (connectionError !== '') {
			OCP.Toast.error(t(OCA.Eurooffice.AppName, 'Error when trying to connect') + ' (' + connectionError + ')')
		}

		$('#euroofficeAddrSave').click(function() {
			$('.section-eurooffice').addClass('icon-loading')
			const euroofficeUrl = $('#euroofficeUrl').val().trim()

			if (!euroofficeUrl.length) {
				$('#euroofficeInternalUrl, #euroofficeStorageUrl, #euroofficeSecret, #euroofficeJwtHeader').val('')
			}

			const euroofficeInternalUrl = ($('#euroofficeInternalUrl').val() || '').trim()
			const euroofficeStorageUrl = ($('#euroofficeStorageUrl').val() || '').trim()
			const euroofficeVerifyPeerOff = $('#euroofficeVerifyPeerOff').prop('checked')
			const euroofficeSecret = ($('#euroofficeSecret').val() || '').trim()
			const jwtHeader = ($('#euroofficeJwtHeader').val() || '').trim()
			const demo = $('#euroofficeDemo').prop('checked')

			$.ajax({
				method: 'PUT',
				url: OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/settings/address'),
				data: {
					documentserver: euroofficeUrl,
					documentserverInternal: euroofficeInternalUrl,
					storageUrl: euroofficeStorageUrl,
					verifyPeerOff: euroofficeVerifyPeerOff,
					secret: euroofficeSecret,
					jwtHeader,
					demo,
				},
				success: function onSuccess(response) {
					$('.section-eurooffice').removeClass('icon-loading')
					if (response && (response.documentserver != null || demo)) {
						$('#euroofficeUrl').val(response.documentserver)
						$('#euroofficeInternalUrl').val(response.documentserverInternal)
						$('#euroofficeStorageUrl').val(response.storageUrl)
						$('#euroofficeSecret').val(response.secret)
						$('#euroofficeJwtHeader').val(response.jwtHeader)

						$('.section-eurooffice-common, .section-eurooffice-templates, .section-eurooffice-watermark').toggleClass('eurooffice-hide', (response.documentserver == null && !demo) || !!response.error.length)

						const versionMessage = response.version ? (' (' + t(OCA.Eurooffice.AppName, 'version') + ' ' + response.version + ')') : ''

						if (response.error) {
							OCP.Toast.error(t(OCA.Eurooffice.AppName, 'Error when trying to connect') + ' (' + response.error + ')' + versionMessage)
						} else {
							if (response.secret !== null) {
								OCP.Toast.success(t(OCA.Eurooffice.AppName, 'Server settings have been successfully updated') + versionMessage)
							} else {
								spawnDialog(defineAsyncComponent(() => import('./views/EmptyJwtInfoDialog.vue')))
							}
						}
					} else {
						$('.section-eurooffice-common, .section-eurooffice-templates, .section-eurooffice-watermark').addClass('eurooffice-hide')
					}
				},
			})
		})

		$('#euroofficeSave').click(function() {
			$('.section-eurooffice').addClass('icon-loading')

			const defFormats = {}
			$('input[id^="euroofficeDefFormat"]').each(function() {
				defFormats[this.name] = this.checked
			})

			const editFormats = {}
			$('input[id^="euroofficeEditFormat"]').each(function() {
				editFormats[this.name] = this.checked
			})

			const sameTab = $('#euroofficeSameTab').is(':checked')
			const enableSharing = $('#euroofficeEnableSharing').is(':checked')
			const preview = $('#euroofficePreview').is(':checked')
			const advanced = $('#euroofficeAdvanced').is(':checked')
			const cronChecker = $('#euroofficeCronChecker').is(':checked')
			const emailNotifications = $('#euroofficeEmailNotifications').is(':checked')
			const versionHistory = $('#euroofficeVersionHistory').is(':checked')

			const limitGroupsString = $('#euroofficeGroups').prop('checked') ? $('#euroofficeLimitGroups').val() : ''
			const limitGroups = limitGroupsString ? limitGroupsString.split('|') : []

			const chat = $('#euroofficeChat').is(':checked')
			const compactHeader = $('#euroofficeCompactHeader').is(':checked')
			const feedback = $('#euroofficeFeedback').is(':checked')
			const forcesave = $('#euroofficeForcesave').is(':checked')
			const liveViewOnShare = $('#euroofficeLiveViewOnShare').is(':checked')
			const help = $('#euroofficeHelp').is(':checked')
			const reviewDisplay = $("input[type='radio'][name='reviewDisplay']:checked").attr('id').replace('euroofficeReviewDisplay_', '')
			const theme = $("input[type='radio'][name='theme']:checked").attr('id').replace('euroofficeTheme_', '')
			const unknownAuthor = $('#euroofficeUnknownAuthor').val().trim()

			$.ajax({
				method: 'PUT',
				url: OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/settings/common'),
				data: {
					defFormats,
					editFormats,
					sameTab,
					enableSharing,
					preview,
					advanced,
					cronChecker,
					emailNotifications,
					versionHistory,
					limitGroups,
					chat,
					compactHeader,
					feedback,
					forcesave,
					liveViewOnShare,
					help,
					reviewDisplay,
					theme,
					unknownAuthor,
				},
				success: function onSuccess(response) {
					$('.section-eurooffice').removeClass('icon-loading')
					if (response) {
						OCP.Toast.success(t(OCA.Eurooffice.AppName, 'Common settings have been successfully updated'))
					}
				},
			})
		})

		$('#euroofficeSecuritySave').click(function() {
			$('.section-eurooffice').addClass('icon-loading')

			const plugins = $('#euroofficePlugins').is(':checked')
			const macros = $('#euroofficeMacros').is(':checked')
			const protection = $("input[type='radio'][name='protection']:checked").attr('id').replace('euroofficeProtection_', '')

			const watermarkSettings = {
				enabled: $('#euroofficeWatermark_enabled').is(':checked'),
			}
			if (watermarkSettings.enabled) {
				watermarkSettings.text = ($('#euroofficeWatermark_text').val() || '').trim()

				const watermarkLabels = [
					'allGroups',
					'allTags',
					'linkAll',
					'linkRead',
					'linkSecure',
					'linkTags',
					'shareAll',
					'shareRead',
				]
				$.each(watermarkLabels, function(i, watermarkLabel) {
					watermarkSettings[watermarkLabel] = $('#euroofficeWatermark_' + watermarkLabel).is(':checked')
				})

				$.each(watermarkGroupLists.concat(watermarkTagLists), function(i, watermarkList) {
					const list = $('#euroofficeWatermark_' + watermarkList).is(':checked') ? $('#euroofficeWatermark_' + watermarkList + 'List').val() : ''
					watermarkSettings[watermarkList + 'List'] = list ? list.split('|') : []
				})
			}

			$.ajax({
				method: 'PUT',
				url: OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/settings/security'),
				data: {
					watermarks: watermarkSettings,
					plugins,
					macros,
					protection,
				},
				success: function onSuccess(response) {
					$('.section-eurooffice').removeClass('icon-loading')
					if (response) {
						OCP.Toast.success(t(OCA.Eurooffice.AppName, 'Security settings have been successfully updated'))
					}
				},
			})
		})

		$('.section-eurooffice-addr input').keypress(function(e) {
			const code = e.keyCode || e.which
			if (code === 13) {
				$('#euroofficeAddrSave').click()
			}
		})

		$('#euroofficeSecret-show').click(function() {
			if ($('#euroofficeSecret').attr('type') === 'password') {
				$('#euroofficeSecret').attr('type', 'text')
			} else {
				$('#euroofficeSecret').attr('type', 'password')
			}
		})

		$('#euroofficeClearVersionHistory').click(function() {
			OC.dialogs.confirm(
				t(OCA.Eurooffice.AppName, 'Are you sure you want to clear metadata?'),
				t(OCA.Eurooffice.AppName, 'Confirm metadata removal'),
				(clicked) => {
					if (!clicked) {
						return
					}

					$('.section-eurooffice').addClass('icon-loading')

					$.ajax({
						method: 'DELETE',
						url: OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/settings/history'),
						success: function onSuccess(response) {
							$('.section-eurooffice').removeClass('icon-loading')
							if (response) {
								OCP.Toast.success(t(OCA.Eurooffice.AppName, 'All history successfully deleted'))
							}
						},
					})
				},
			)
		})

		$('#euroofficeAddTemplate').change(function() {
			const file = this.files[0]
			const data = new FormData()

			data.append('file', file)

			$('.section-eurooffice').addClass('icon-loading')
			OCA.Eurooffice.AddTemplate(file, (template, error) => {

				$('.section-eurooffice').removeClass('icon-loading')
				const message = error
					? t(OCA.Eurooffice.AppName, 'Error') + ': ' + error
					: t(OCA.Eurooffice.AppName, 'Template successfully added')

				if (error) {
					OCP.Toast.error(message)
					return
				}

				if (template) {
					OCA.Eurooffice.AttachItemTemplate(template)
				}
				OCP.Toast.success(message)
			})
		})

		$(document).on('click', '.eurooffice-template-delete', function(event) {
			const item = $(event.target).parents('.eurooffice-template-item')
			const templateId = $(item).attr('data-id')

			$('.section-eurooffice').addClass('icon-loading')
			OCA.Eurooffice.DeleteTemplate(templateId, (response) => {
				$('.section-eurooffice').removeClass('icon-loading')

				const message = response.error
					? t(OCA.Eurooffice.AppName, 'Error') + ': ' + response.error
					: t(OCA.Eurooffice.AppName, 'Template successfully deleted')
				if (response.error) {
					OCP.Toast.error(message)
					return
				}

				$(item).detach()
				OCP.Toast.success(message)
			})
		})

		$(document).on('click', '.eurooffice-template-item p', function(event) {
			const item = $(event.target).parents('.eurooffice-template-item')
			const templateId = $(item).attr('data-id')

			const url = OC.generateUrl('/apps/' + OCA.Eurooffice.AppName + '/{fileId}?template={template}',
				{
					fileId: templateId,
					template: 'true',
				})

			window.open(url)
		})

		$(document).on('click', '.eurooffice-template-download', function(event) {
			const item = $(event.target).parents('.eurooffice-template-item')
			const templateId = $(item).attr('data-id')

			const downloadLink = OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/downloadas?fileId={fileId}&template={template}', {
				fileId: templateId,
				template: 'true',
			})

			location.href = downloadLink
		})

		const sameTabCheckbox = document.getElementById('euroofficeSameTab')
		const sharingBlock = document.getElementById('euroofficeEnableSharingBlock')
		const sharingCheckbox = document.getElementById('euroofficeEnableSharing')

		sameTabCheckbox.onclick = function() {
			const isChecked = sameTabCheckbox.checked
			sharingBlock.style.display = isChecked ? 'none' : 'block'
			sharingCheckbox.checked = isChecked ? sharingCheckbox.checked : false
		}
	})

})(jQuery, OC)
