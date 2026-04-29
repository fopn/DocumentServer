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

/* global _, DocsAPI, jQuery, moment, oc_defaults */

/**
 * @param {object} $ JQueryStatic object
 * @param {object} OCA Nextcloud OCA object
 */
(function($, OCA) {

	OCA.Eurooffice = Object.assign({
		AppName: 'eurooffice',
		inframe: false,
		inviewer: false,
		fileId: null,
		shareToken: null,
		insertImageType: null,
	}, OCA.Eurooffice)

	OCA.Eurooffice.InitEditor = function() {

		OCA.Eurooffice.fileId = $('#iframeEditor').data('id')
		OCA.Eurooffice.shareToken = $('#iframeEditor').data('sharetoken')
		OCA.Eurooffice.directToken = $('#iframeEditor').data('directtoken')
		OCA.Eurooffice.template = $('#iframeEditor').data('template')
		OCA.Eurooffice.inframe = !!$('#iframeEditor').data('inframe')
		OCA.Eurooffice.inviewer = !!$('#iframeEditor').data('inviewer')
		OCA.Eurooffice.filePath = $('#iframeEditor').data('path')
		OCA.Eurooffice.anchor = $('#iframeEditor').attr('data-anchor')
		OCA.Eurooffice.currentWindow = window
		OCA.Eurooffice.currentUser = OC.getCurrentUser()

		if (OCA.Eurooffice.inframe) {
			OCA.Eurooffice.currentWindow = window.parent
			OCA.Eurooffice.currentUser = OCA.Eurooffice.currentWindow.OC.getCurrentUser()
		}

		if (!OCA.Eurooffice.fileId && !OCA.Eurooffice.shareToken && !OCA.Eurooffice.directToken) {
			OCA.Eurooffice.showMessage(t(OCA.Eurooffice.AppName, 'FileId is empty'), 'error', { timeout: -1 })
			return
		}

		const configUrl = OCA.Eurooffice.getConfigUrl()

		$.ajax({
			url: configUrl,
			success: function onSuccess(config) {
				if (config) {
					OCA.Eurooffice.device = config.type
					if (OCA.Eurooffice.device === 'mobile') {
						OCA.Eurooffice.resizeEvents()
					}

					if (config.redirectUrl) {
						location.href = config.redirectUrl
						return
					}

					if (config.error != null) {
						OCA.Eurooffice.showMessage(config.error, 'error', { timeout: -1 })
						return
					}

					if (!config.documentServerUrl) {
						OCA.Eurooffice.showMessage('Euro-Office cannot be reached. Please contact admin', 'error', { timeout: -1 })
						return
					}

					const script = document.createElement('script')
					script.src = config.documentServerUrl + 'web-apps/apps/api/documents/api.js?shardKey=' + config.document.key
					script.setAttribute('nonce', btoa(OC.requestToken))
					script.onerror = function() {
						OCA.Eurooffice.showMessage(t(OCA.Eurooffice.AppName, 'Euro-Office cannot be reached. Please contact admin'), 'error', { timeout: -1 })
					}
					script.onload = function() {
						if (typeof DocsAPI === 'undefined') {
							OCA.Eurooffice.showMessage(t(OCA.Eurooffice.AppName, 'Euro-Office cannot be reached. Please contact admin'), 'error', { timeout: -1 })
							return
						}

						const docsVersion = DocsAPI.DocEditor.version().split('.')
						if ((docsVersion[0] < 6)
							|| (parseInt(docsVersion[0]) === 6 && parseInt(docsVersion[1]) === 0)) {
							OCA.Eurooffice.showMessage(t(OCA.Eurooffice.AppName, 'Not supported version'), 'error', { timeout: -1 })
							return
						}

						let docIsChanged = null
						let docIsChangedTimeout = null

						const setPageTitle = function(event) {
							clearTimeout(docIsChangedTimeout)

							if (docIsChanged !== event.data) {
								const titleChange = function() {
									OCA.Eurooffice.currentWindow.document.title = config.document.title + (event.data ? ' *' : '') + ' - ' + oc_defaults.title
									docIsChanged = event.data
								}

								if (event === false || event.data) {
									titleChange()
								} else {
									docIsChangedTimeout = setTimeout(titleChange, 500)
								}
							}
						}
						setPageTitle(false)

						OCA.Eurooffice.documentType = config.documentType

						config.events = {
							onDocumentStateChange: setPageTitle,
							onDocumentReady: OCA.Eurooffice.onDocumentReady,
							onMakeActionLink: OCA.Eurooffice.onMakeActionLink,
						}

						if (config.editorConfig.tenant) {
							config.events.onAppReady = function() {
								OCA.Eurooffice.docEditor.showMessage(t(OCA.Eurooffice.AppName, 'You are using public demo Euro-Office server. Please do not store private sensitive data.'))
							}
						}

						if ((OCA.Eurooffice.inframe && !OCA.Eurooffice.shareToken)
							|| (OCA.Eurooffice.currentUser.uid)) {
							config.events.onRequestSaveAs = OCA.Eurooffice.onRequestSaveAs
							config.events.onRequestInsertImage = OCA.Eurooffice.onRequestInsertImage
							config.events.onRequestMailMergeRecipients = OCA.Eurooffice.onRequestMailMergeRecipients
							config.events.onRequestCompareFile = OCA.Eurooffice.onRequestSelectDocument // todo: remove (for editors 7.4)
							config.events.onRequestSelectDocument = OCA.Eurooffice.onRequestSelectDocument
							config.events.onRequestSendNotify = OCA.Eurooffice.onRequestSendNotify
							config.events.onRequestReferenceData = OCA.Eurooffice.onRequestReferenceData
							config.events.onRequestOpen = OCA.Eurooffice.onRequestOpen
							config.events.onRequestReferenceSource = OCA.Eurooffice.onRequestReferenceSource
							config.events.onMetaChange = OCA.Eurooffice.onMetaChange
							config.events.onRequestRefreshFile = OCA.Eurooffice.onRequestRefreshFile

							if (OCA.Eurooffice.currentUser.uid) {
								config.events.onRequestUsers = OCA.Eurooffice.onRequestUsers
							}

							if (!OCA.Eurooffice.filePath) {
								OCA.Eurooffice.filePath = config._file_path
							}

							if (!OCA.Eurooffice.template) {
								config.events.onRequestHistory = OCA.Eurooffice.onRequestHistory
								config.events.onRequestHistoryData = OCA.Eurooffice.onRequestHistoryData
								config.events.onRequestRestore = OCA.Eurooffice.onRequestRestore
								config.events.onRequestHistoryClose = OCA.Eurooffice.onRequestHistoryClose
							}
						}

						if (OCA.Eurooffice.directEditor || OCA.Eurooffice.inframe) {
							config.events.onRequestClose = OCA.Eurooffice.onRequestClose
						}

						if (OCA.Eurooffice.inframe
							&& config._files_sharing && !OCA.Eurooffice.shareToken
							&& window.parent.OCA.Eurooffice.context) {
							config.events.onRequestSharingSettings = OCA.Eurooffice.onRequestSharingSettings
						}

						OCA.Eurooffice.docEditor = new DocsAPI.DocEditor('iframeEditor', config)

						if (OCA.Eurooffice.directEditor) {
							OCA.Eurooffice.directEditor.loaded()
						}

						if (!OCA.Eurooffice.directEditor
							&& config.type === 'mobile' && $('#app > iframe').css('position') === 'fixed') {
							$('#app > iframe').css('height', 'calc(100% - 50px)')
						}

						const favicon = OC.filePath(OCA.Eurooffice.AppName, 'img', OCA.Eurooffice.documentType + '.ico')
						if (OCA.Eurooffice.inframe) {
							window.parent.postMessage({
								method: 'changeFavicon',
								param: favicon,
							},
							'*')
						} else {
							$('link[rel="icon"]').attr('href', favicon)
						}
					}
					document.head.appendChild(script)
				}
			},
		})
	}

	OCA.Eurooffice.onRequestHistory = function(version) {
		$.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/history?fileId={fileId}',
			{
				fileId: OCA.Eurooffice.fileId || 0,
			}),
		function onSuccess(response) {
			OCA.Eurooffice.refreshHistory(response, version)
		})
	}

	OCA.Eurooffice.onRequestHistoryData = function(event) {
		const version = event.data

		$.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/version?fileId={fileId}&version={version}',
			{
				fileId: OCA.Eurooffice.fileId || 0,
				version,
			}),
		function onSuccess(response) {
			if (response.error) {
				response = {
					error: response.error,
					version,
				}
			}
			OCA.Eurooffice.docEditor.setHistoryData(response)
		})
	}

	OCA.Eurooffice.onRequestRestore = function(event) {
		const version = event.data.version

		$.ajax({
			method: 'PUT',
			url: OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/restore'),
			data: {
				fileId: OCA.Eurooffice.fileId || 0,
				version,
			},
			success: function onSuccess(response) {
				OCA.Eurooffice.refreshHistory(response, response.at(-1).version)

				if (OCA.Eurooffice.inframe) {
					window.parent.postMessage({
						method: 'onRefreshVersionsDialog',
					},
					'*')
				}
			},
		})
	}

	OCA.Eurooffice.onRequestHistoryClose = function() {
		location.reload(true)
	}

	OCA.Eurooffice.onDocumentReady = function() {
		if (OCA.Eurooffice.inframe) {
			window.parent.postMessage({
				method: 'onDocumentReady',
				param: {},
			},
			'*')
		}

		OCA.Eurooffice.resize()
		OCA.Eurooffice.setViewport()
	}

	OCA.Eurooffice.onRequestSaveAs = function(event) {
		const saveData = {
			name: event.data.title,
			url: event.data.url,
		}

		if (OCA.Eurooffice.filePath) {
			const arrayPath = OCA.Eurooffice.filePath.split('/')
			arrayPath.pop()
			arrayPath.shift()
			saveData.dir = '/' + arrayPath.join('/')
		}

		if (OCA.Eurooffice.inframe) {
			window.parent.postMessage({
				method: 'editorRequestSaveAs',
				param: saveData,
			},
			'*')
		} else {
			OC.dialogs.filepicker(t(OCA.Eurooffice.AppName, 'Save as'),
				function(fileDir) {
					saveData.dir = fileDir
					OCA.Eurooffice.editorSaveAs(saveData)
				},
				false,
				'httpd/unix-directory',
				true,
				OC.dialogs.FILEPICKER_TYPE_CHOOSE,
				saveData.dir)
		}
	}

	OCA.Eurooffice.editorSaveAs = function(saveData) {
		$.post(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/save'),
			saveData,
			function onSuccess(response) {
				if (response.error) {
					OCA.Eurooffice.showMessage(response.error, 'error')
					return
				}

				OCA.Eurooffice.showMessage(t(OCA.Eurooffice.AppName, 'File saved') + ' (' + response.name + ')')
			})
	}

	OCA.Eurooffice.onRequestInsertImage = function(event) {
		const imageMimes = [
			'image/bmp', 'image/x-bmp', 'image/x-bitmap', 'application/bmp',
			'image/gif', 'image/tiff',
			'image/jpeg', 'image/jpg', 'application/jpg', 'application/x-jpg',
			'image/png', 'image/x-png', 'application/png', 'application/x-png',
			'image/svg+xml',
		]

		if (event.data) {
			OCA.Eurooffice.insertImageType = event.data.c
		}

		if (OCA.Eurooffice.inframe) {
			window.parent.postMessage({
				method: 'editorRequestInsertImage',
				param: imageMimes,
			},
			'*')
		} else {
			OC.dialogs.filepicker(t(OCA.Eurooffice.AppName, 'Insert image'),
				OCA.Eurooffice.editorInsertImage,
				false,
				imageMimes,
				true)
		}
	}

	OCA.Eurooffice.editorInsertImage = function(filePath) {
		$.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/url?filePath={filePath}',
			{
				filePath,
			}),
		function onSuccess(response) {
			if (response.error) {
				OCA.Eurooffice.showMessage(response.error, 'error')
				return
			}

			if (OCA.Eurooffice.insertImageType) {
				response.c = OCA.Eurooffice.insertImageType
			}

			OCA.Eurooffice.docEditor.insertImage(response)
		})
	}

	OCA.Eurooffice.onRequestMailMergeRecipients = function() {
		const recipientMimes = [
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		]

		if (OCA.Eurooffice.inframe) {
			window.parent.postMessage({
				method: 'editorRequestMailMergeRecipients',
				param: recipientMimes,
			},
			'*')
		} else {
			OC.dialogs.filepicker(t(OCA.Eurooffice.AppName, 'Select recipients'),
				OCA.Eurooffice.editorSetRecipient,
				false,
				recipientMimes,
				true)
		}
	}

	OCA.Eurooffice.editorSetRecipient = function(filePath) {
		$.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/url?filePath={filePath}',
			{
				filePath,
			}),
		function onSuccess(response) {
			if (response.error) {
				OCA.Eurooffice.showMessage(response.error, 'error')
				return
			}

			OCA.Eurooffice.docEditor.setMailMergeRecipients(response)
		})
	}

	OCA.Eurooffice.editorReferenceSource = function(filePath) {
		if (filePath === OCA.Eurooffice.filePath) {
			OCA.Eurooffice.showMessage(t(OCA.Eurooffice.AppName, 'The data source must not be the current document'), 'error')
			return
		}

		$.post(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/reference'),
			{
				path: filePath,
			},
			function onSuccess(response) {
				if (response.error) {
					OCA.Eurooffice.showMessage(response.error, 'error')
					return
				}
				OCA.Eurooffice.docEditor.setReferenceSource(response)
			})
	}

	OCA.Eurooffice.onRequestClose = function() {
		if (OCA.Eurooffice.directEditor) {
			OCA.Eurooffice.directEditor.close()
			return
		}

		OCA.Eurooffice.docEditor.destroyEditor()

		window.parent.postMessage({
			method: 'editorRequestClose',
		},
		'*')
	}

	OCA.Eurooffice.onRequestSharingSettings = function() {
		window.parent.postMessage({
			method: 'editorRequestSharingSettings',
		},
		'*')
	}

	OCA.Eurooffice.onRequestSelectDocument = function(event) {
		const revisedMimes = [
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		]

		if (OCA.Eurooffice.inframe) {
			window.parent.postMessage({
				method: 'editorRequestSelectDocument',
				param: revisedMimes,
				documentSelectionType: event.data.c,
			},
			'*')
		} else {
			let title
			switch (event.data.c) {
			case 'combine':
				title = t(OCA.Eurooffice.AppName, 'Select file to combine')
				break
			case 'compare':
				title = t(OCA.Eurooffice.AppName, 'Select file to compare')
				break
			case 'insert-text':
				title = t(OCA.Eurooffice.AppName, 'Select file to insert text')
				break
			default:
				title = t(OCA.Eurooffice.AppName, 'Select file')
			}
			OC.dialogs.filepicker(title,
				OCA.Eurooffice.editorSetRequested.bind({ documentSelectionType: event.data.c }),
				false,
				revisedMimes,
				true)
		}
	}

	OCA.Eurooffice.editorSetRequested = function(filePath) {
		const documentSelectionType = this.documentSelectionType
		$.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/url?filePath={filePath}',
			{
				filePath,
			}),
		function onSuccess(response) {
			if (response.error) {
				OCP.Toast.error(response.error)
				return
			}
			response.c = documentSelectionType

			OCA.Eurooffice.docEditor.setRequestedDocument(response)
		})
	}

	OCA.Eurooffice.onMakeActionLink = function(event) {
		let url = location.href
		if (event && event.data) {
			const indexAnchor = url.indexOf('#')
			if (parseInt(indexAnchor) !== -1) {
				url = url.substring(0, indexAnchor)
			}

			let data = JSON.stringify(event.data)
			data = 'anchor=' + encodeURIComponent(data)

			const inframeRegex = /inframe=([^&]*&?)/g
			if (inframeRegex.test(url)) {
				url = url.replace(inframeRegex, data)
			}

			const anchorRegex = /anchor=([^&]*)/g
			if (anchorRegex.test(url)) {
				url = url.replace(anchorRegex, data)
			} else {
				url += (url.indexOf('?') === -1) ? '?' : '&'
				url += data
			}
		}

		OCA.Eurooffice.docEditor.setActionLink(url)
	}

	OCA.Eurooffice.onRequestUsers = function(event) {
		const operationType = typeof (event.data.c) !== 'undefined' ? event.data.c : null
		switch (operationType) {
		case 'info': {
			$.get(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/userInfo?userIds={userIds}',
				{
					userIds: JSON.stringify(event.data.id),
				}),
			function onSuccess(response) {
				OCA.Eurooffice.docEditor.setUsers({
					c: operationType,
					users: response,
				})
			})
			break
		}
		default: {
			let requestString = 'apps/' + OCA.Eurooffice.AppName + '/ajax/users?fileId={fileId}&operationType=' + operationType
			if (typeof (event.data.search) !== 'undefined') {
				requestString += '&from=' + event.data.from + '&count=' + event.data.count + '&search=' + encodeURIComponent(event.data.search)
			}
			$.get(OC.generateUrl(requestString,
				{
					fileId: OCA.Eurooffice.fileId || 0,
				}),
			function onSuccess(response) {
				OCA.Eurooffice.docEditor.setUsers({
					c: operationType,
					users: response,
					// support v9.0
					total: 1 + (!event.data.count || response.length < event.data.count ? 0 : (event.data.from + event.data.count)),
					// since v9.0.1
					isPaginated: true,
				})
			})
		}
		}
	}

	OCA.Eurooffice.onRequestSendNotify = function(event) {
		const actionLink = event.data.actionLink
		const comment = event.data.message
		const emails = event.data.emails

		const fileId = OCA.Eurooffice.fileId

		$.post(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/mention'),
			{
				fileId,
				anchor: JSON.stringify(actionLink),
				comment,
				emails,
			},
			function onSuccess(response) {
				if (response.error) {
					OCA.Eurooffice.showMessage(response.error, 'error')
					return
				}

				OCA.Eurooffice.showMessage(response.message)
			})
	}

	OCA.Eurooffice.onRequestReferenceData = function(event) {
		const link = event.data.link
		const referenceData = event.data.referenceData
		const path = event.data.path

		$.post(OC.generateUrl('apps/' + OCA.Eurooffice.AppName + '/ajax/reference'),
			{
				referenceData,
				path,
				link,
			},
			function onSuccess(response) {
				if (response.error) {
					OCA.Eurooffice.showMessage(response.error, 'error')
					return
				}

				OCA.Eurooffice.docEditor.setReferenceData(response)
			})
	}

	OCA.Eurooffice.onRequestOpen = function(event) {
		const filePath = event.data.path
		const fileId = event.data.referenceData.fileKey
		const windowName = event.data.windowName
		const sourceUrl = OC.generateUrl(`apps/${OCA.Eurooffice.AppName}/${fileId}?filePath=${OC.encodePath(filePath)}`)
		window.open(sourceUrl, windowName)
	}

	OCA.Eurooffice.onRequestReferenceSource = function(event) {
		const referenceSourceMimes = [
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		]
		if (OCA.Eurooffice.inframe) {
			window.parent.postMessage({
				method: 'editorRequestReferenceSource',
				param: referenceSourceMimes,
			},
			'*')
		} else {
			OC.dialogs.filepicker(t(OCA.Eurooffice.AppName, 'Select data source'),
				OCA.Eurooffice.editorReferenceSource,
				false,
				referenceSourceMimes,
				true)
		}
	}

	OCA.Eurooffice.onMetaChange = function(event) {
		if (event.data.favorite !== undefined) {
			$.ajax({
				url: OC.generateUrl('apps/files/api/v1/files' + OC.encodePath(OCA.Eurooffice.filePath)),
				type: 'post',
				data: JSON.stringify({
					tags: event.data.favorite ? [OC.TAG_FAVORITE] : [],
				}),
				contentType: 'application/json',
				dataType: 'json',
				success() {
					OCA.Eurooffice.docEditor.setFavorite(event.data.favorite)
				},
			})
		}
	}

	OCA.Eurooffice.onRequestRefreshFile = function() {
		const configUrl = OCA.Eurooffice.getConfigUrl()
		$.ajax({
			url: configUrl,
			success: function onSuccess(config) {
				OCA.Eurooffice.docEditor.refreshFile(config)
			},
		})
	}

	OCA.Eurooffice.showMessage = function(message, type = 'success', props = null) {
		if (OCA.Eurooffice.directEditor) {
			OCA.Eurooffice.directEditor.loaded()
		}

		if (OCA.Eurooffice.inframe) {
			window.parent.postMessage({
				method: 'onShowMessage',
				param: {
					message,
					type,
					props,
				},
			},
			'*')
			return
		}

		switch (type) {
		case 'success':
			OCP.Toast.success(message, props)
			break
		case 'error':
			OCP.Toast.error(message, props)
			break
		}
	}

	OCA.Eurooffice.refreshHistory = function(response, version) {
		let data = {}
		if (response.error) {
			data = { error: response.error }
		} else {
			let currentVersion = 0
			$.each(response, function(i, fileVersion) {
				if (fileVersion.version >= currentVersion) {
					currentVersion = fileVersion.version
				}

				fileVersion.created = moment(fileVersion.created * 1000).format('L LTS')
				if (fileVersion.changes) {
					$.each(fileVersion.changes, function(j, change) {
						change.created = moment(change.created + '+00:00').format('L LTS')
					})
				}
			})

			if (version) {
				currentVersion = Math.min(currentVersion, version)
			}

			data = {
				currentVersion,
				history: response,
			}
		}
		OCA.Eurooffice.docEditor.refreshHistory(data)
	}

	OCA.Eurooffice.resize = function() {
		if (OCA.Eurooffice.device !== 'mobile') {
			return
		}

		const headerHeight = $('#header').length > 0 ? $('#header').height() : 50
		const wrapEl = $('#app>iframe')
		if (wrapEl.length > 0) {
			wrapEl[0].style.height = (screen.availHeight - headerHeight) + 'px'
			window.scrollTo(0, -1)
			wrapEl[0].style.height = (window.top.innerHeight - headerHeight) + 'px'
		}
	}

	OCA.Eurooffice.resizeEvents = function() {
		if (window.addEventListener) {
			if (/Android/i.test(navigator.userAgent)) {
				window.addEventListener('resize', OCA.Eurooffice.resize)
			}
			if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
				window.addEventListener('orientationchange', OCA.Eurooffice.resize)
			}
		}
	}

	OCA.Eurooffice.setViewport = function() {
		document.querySelector('meta[name="viewport"]').setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0')
	}

	OCA.Eurooffice.getConfigUrl = function() {
		const guestName = localStorage.getItem('nick')
		let configUrl = OC.linkToOCS('apps/' + OCA.Eurooffice.AppName + '/api/v1/config', 2) + (OCA.Eurooffice.fileId || 0)

		const params = []
		if (OCA.Eurooffice.filePath) {
			params.push('filePath=' + encodeURIComponent(OCA.Eurooffice.filePath))
		}
		if (OCA.Eurooffice.shareToken) {
			params.push('shareToken=' + encodeURIComponent(OCA.Eurooffice.shareToken))
		}
		if (OCA.Eurooffice.directToken) {
			$('html').addClass('eurooffice-full-page')
			params.push('directToken=' + encodeURIComponent(OCA.Eurooffice.directToken))
		}
		if (OCA.Eurooffice.template) {
			params.push('template=true')
		}
		if (guestName && guestName !== 'null') {
			params.push('guestName=' + encodeURIComponent(guestName))
		}
		if (OCA.Eurooffice.anchor) {
			params.push('anchor=' + encodeURIComponent(OCA.Eurooffice.anchor))
		}

		if (OCA.Eurooffice.inframe || OCA.Eurooffice.directToken) {
			params.push('inframe=true')
		}

		if (OCA.Eurooffice.inviewer) {
			params.push('inviewer=true')
		}

		if (OCA.Eurooffice.Desktop) {
			params.push('desktop=true')
		}
		if (params.length) {
			configUrl += '?' + params.join('&')
		}

		return configUrl
	}

	OCA.Eurooffice.InitEditor()

})(jQuery, OCA)
