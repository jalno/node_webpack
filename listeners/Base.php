<?php
namespace packages\node_webpack\listeners;

use packages\base\{packages, json, IO\file, IO\directory, frontend\theme, view\events\beforeLoad};
use packages\criticalcss\listeners\MVC as CriticalCSS;
class Base {
	public function beforeLoadView(beforeLoad $event) {
		$view = $event->getView();
		
		$sources = theme::byName($view->getSource()->getName());
		$webpackAssets = $this->checkAssetsForWebpack($sources);
		$view->clearAssets();

		foreach ($webpackAssets as $asset) {
			if ($asset["type"] == "css") {
				if (isset($asset["file"])) {
					$view->addCSSFile($asset["file"] . ((isset($asset["hash"]) and $asset["hash"]) ? "?{$asset['hash']}" : ""), isset($asset["name"]) ? $asset["name"] : "");
				} else if (isset($asset["inline"])) {
					$view->addCSS($asset["inline"], isset($asset["name"]) ? $asset["name"] : "");
				}
			} elseif ($asset["type"] == "js") {
				if (isset($asset["file"])) {
					$view->addJSFile($asset["file"] . ((isset($asset["hash"]) and $asset["hash"]) ? "?{$asset['hash']}" : ""), isset($asset["name"]) ? $asset["name"] : "");
				} else if (isset($asset["inline"])) {
					$view->addJS($asset["inline"], isset($asset["name"]) ? $asset["name"] : "");
				}
			}
		}
		if (class_exists(CriticalCSS::class)) {
			CriticalCSS::injectCriticalCSS($view);
		}
	}
	public function checkAssetsForWebpack(array $sources): array {
		$result = $this->getWebpackResult();
		$filteredAssets = [];
		$filteredFiles = [];
		$commonAssets = [];
		if (isset($result["outputedFiles"]["common"])) {
			foreach ($result["outputedFiles"]["common"] as $file) {
				$file = new file\local($file["name"]);
				$commonAssets[] = array(
					"type" => $file->getExtension(),
					"file" => "/".$file->getPath()
				);
				$filteredFiles[] = $file->getPath();
			}
		}
		foreach ($sources as $source) {
			$handledFiles = [];
			$name = $source->getName();
			$assets = $source->getAssets();
			if (isset($result["handledFiles"][$name])) {
				$handledFiles = $result["handledFiles"][$name];
			}
			if (isset($result["outputedFiles"][$name])) {
				foreach ($result["outputedFiles"][$name] as $item) {
					$file = new file\local($item["name"]);
					if (! in_array($file->getPath(), $filteredFiles)) {
						$filteredAssets[] = array(
							"type" => $file->getExtension(),
							"file" => "/".$file->getPath(),
							"hash" => $item["hash"] ?? "",
						);
						$filteredFiles[] = $file->getPath();
					}
				}
			}
			foreach ($assets as $asset) {
				if (in_array($asset["type"], ["js", "css", "less", "ts", "scss", "sass"])) {
					if (isset($asset["file"])) {
						if (! in_array($source->getPath()."/".$asset["file"], $handledFiles)) {
							$asset["file"] = $source->url($asset["file"]);
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
	private function getWebpackResult(): array {
		$nodejs = new directory\local(packages::package("node_webpack")->getFilePath("nodejs"));
		$result = array();
		$resultFile = $nodejs->file("result.json");
		if ($resultFile->exists()) {
			$result = json\decode($resultFile->read());
		}
		if (! is_array($result)) {
			$result = array();
		}
		if (! isset($result["handledFiles"])) {
			$result["handledFiles"] = [];
		}
		if (! isset($result["outputedFiles"])) {
			$result["outputedFiles"] = [];
		}
		return $result;
	}
}
