<?php
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
 *
 * All the Product's GUI elements, including illustrations and icon sets, as well as technical
 * writing content are licensed under the terms of the Creative Commons Attribution-ShareAlike 4.0 International.
 * See the License terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

namespace OCA\Eurooffice\Listeners;

use OCA\Eurooffice\AppConfig;
use OCA\Eurooffice\AppInfo\Application;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\Files\Template\RegisterTemplateCreatorEvent;
use OCP\Files\Template\TemplateFileCreator;
use OCP\IL10N;

/** @template-implements IEventListener<Event|RegisterTemplateCreatorEvent> */
class RegisterTemplateCreatorListener implements IEventListener {

    public function __construct(
        private readonly AppConfig $appConfig,
        private readonly IL10N $l10n,
    ) {}

    public function handle(Event $event): void {
        if (!$event instanceof RegisterTemplateCreatorEvent) {
            return;
        }

        if (empty($this->appConfig->getDocumentServerUrl())
            || !$this->appConfig->settingsAreSuccessful()
            || !$this->appConfig->isUserAllowedToUse()) {
            return;
        }

        $templateManager = $event->getTemplateManager();
        $appName = Application::APP_ID;
        $imgDir = __DIR__ . '/../../img';

        $templateManager->registerTemplateFileCreator(function () use ($appName, $imgDir): TemplateFileCreator {
            $wordTemplate = new TemplateFileCreator($appName, $this->l10n->t('New document'), '.docx');
            $wordTemplate->addMimetype('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            $wordTemplate->setIconSvgInline(file_get_contents($imgDir . '/new-docx.svg'));
            $wordTemplate->setRatio(21 / 29.7);
            return $wordTemplate;
        });

        $templateManager->registerTemplateFileCreator(function () use ($appName, $imgDir): TemplateFileCreator {
            $cellTemplate = new TemplateFileCreator($appName, $this->l10n->t('New spreadsheet'), '.xlsx');
            $cellTemplate->addMimetype('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            $cellTemplate->setIconSvgInline(file_get_contents($imgDir . '/new-xlsx.svg'));
            $cellTemplate->setRatio(21 / 29.7);
            return $cellTemplate;
        });

        $templateManager->registerTemplateFileCreator(function () use ($appName, $imgDir): TemplateFileCreator {
            $slideTemplate = new TemplateFileCreator($appName, $this->l10n->t('New presentation'), '.pptx');
            $slideTemplate->addMimetype('application/vnd.openxmlformats-officedocument.presentationml.presentation');
            $slideTemplate->setIconSvgInline(file_get_contents($imgDir . '/new-pptx.svg'));
            $slideTemplate->setRatio(16 / 9);
            return $slideTemplate;
        });
    }
}
