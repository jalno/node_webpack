<?php
namespace packages\node_webpack\processes;

use packages\base\{Process, Translator, json};

class GetJalnoOptions extends Process {
	public function getAvailableLangs() {
		echo json\encode(Translator::getAvailableLangs());
	}
}
