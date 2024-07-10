<?php

namespace packages\node_webpack\Processes;

use packages\base\Json;
use packages\base\Process;
use packages\base\Translator;

class GetJalnoOptions extends Process
{
    public function getAvailableLangs()
    {
        echo json\encode(Translator::getAvailableLangs());
    }
}
