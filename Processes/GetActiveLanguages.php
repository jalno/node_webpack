<?php
namespace packages\node_webpack\Processes;

use packages\base\{Process, Translator, Json};

class GetJalnoOptions extends Process {
	public function getAvailableLangs() {
		echo json\encode(Translator::getAvailableLangs());
	}
}
