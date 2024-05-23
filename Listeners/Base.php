<?php

namespace packages\node_webpack\Listeners;

use packages\base\Frontend\Theme;
use packages\base\IO\Directory;
use packages\base\IO\File;
use packages\base\Json;
use packages\base\Packages;
use packages\base\View\Events\BeforeLoad;
use packages\criticalcss\Listeners\MVC as CriticalCSS;

class Base
{
    public function beforeLoadView(BeforeLoad $event)
    {
        $view = $event->getView();

        $sources = Theme::byName($view->getSource()->getName());
        $webpackAssets = $this->checkAssetsForWebpack($sources);
        $view->clearAssets();

        foreach ($webpackAssets as $asset) {
            if ('css' == $asset['type']) {
                if (isset($asset['file'])) {
                    $view->addCSSFile($asset['file'].((isset($asset['hash']) and $asset['hash']) ? "?{$asset['hash']}" : ''), isset($asset['name']) ? $asset['name'] : '');
                } elseif (isset($asset['inline'])) {
                    $view->addCSS($asset['inline'], isset($asset['name']) ? $asset['name'] : '');
                }
            } elseif ('js' == $asset['type']) {
                if (isset($asset['file'])) {
                    $view->addJSFile($asset['file'].((isset($asset['hash']) and $asset['hash']) ? "?{$asset['hash']}" : ''), isset($asset['name']) ? $asset['name'] : '');
                } elseif (isset($asset['inline'])) {
                    $view->addJS($asset['inline'], isset($asset['name']) ? $asset['name'] : '');
                }
            }
        }
        if (class_exists(CriticalCSS::class)) {
            CriticalCSS::injectCriticalCSS($view);
        }
    }

    public function checkAssetsForWebpack(array $sources): array
    {
        $result = $this->getWebpackResult();
        $filteredAssets = [];
        $filteredFiles = [];
        $commonAssets = [];
        if (isset($result['outputedFiles']['common'])) {
            foreach ($result['outputedFiles']['common'] as $file) {
                $file = new File\Local($file['name']);
                $commonAssets[] = [
                    'type' => $file->getExtension(),
                    'file' => '/'.$file->getPath(),
                ];
                $filteredFiles[] = $file->getPath();
            }
        }
        foreach ($sources as $source) {
            $handledFiles = [];
            $name = $source->getName();
            $assets = $source->getAssets();
            if (isset($result['handledFiles'][$name])) {
                $handledFiles = $result['handledFiles'][$name];
            }
            if (isset($result['outputedFiles'][$name])) {
                foreach ($result['outputedFiles'][$name] as $item) {
                    $file = new File\Local($item['name']);
                    if (!in_array($file->getPath(), $filteredFiles)) {
                        $filteredAssets[] = [
                            'type' => $file->getExtension(),
                            'file' => '/'.$file->getPath(),
                            'hash' => $item['hash'] ?? '',
                        ];
                        $filteredFiles[] = $file->getPath();
                    }
                }
            }
            foreach ($assets as $asset) {
                if (in_array($asset['type'], ['js', 'css', 'less', 'ts', 'scss', 'sass'])) {
                    if (isset($asset['file'])) {
                        if (!in_array($source->getPath().'/'.$asset['file'], $handledFiles)) {
                            $asset['file'] = $source->url($asset['file']);
                            $filteredAssets[] = $asset;
                        }
                    } else {
                        $filteredAssets[] = $asset;
                    }
                }
            }
        }

        return array_merge($commonAssets, $filteredAssets);
    }

    private function getWebpackResult(): array
    {
        $nodejs = new Directory\Local(Packages::package('node_webpack')->getFilePath('nodejs'));
        $result = [];
        $resultFile = $nodejs->file('result.json');
        if ($resultFile->exists()) {
            $result = json\decode($resultFile->read());
        }
        if (!is_array($result)) {
            $result = [];
        }
        if (!isset($result['handledFiles'])) {
            $result['handledFiles'] = [];
        }
        if (!isset($result['outputedFiles'])) {
            $result['outputedFiles'] = [];
        }

        return $result;
    }
}
