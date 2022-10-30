#!/bin/sh

#NUM_EXTS=5
#echo $@ | xargs -n $NUM_EXTS
#EXTEN=$1

for i in $@; do
cat <<EOF | nc 192.168.0.146 5038
Action: login
Username: manageruser
Secret:

Action: Originate
Channel: SIP/$i
Application: ConfBridge
Data: 800
Timeout: 60000
Async: 1

EOF

done
