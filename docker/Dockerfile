# We still use  node 8 because of compatibility issues with some of the node-gyp dependencies
FROM node:8-alpine

# Add some apk dependencies of iobroker
# `--virtual .gyp` --> for node-gyp modules in general (alpine specific)
# `g++ linux-headers make python udev` --> for the node-gyp dependencies of iobroker
RUN apk add --no-cache --virtual .gyp g++ make python linux-headers udev

# Copy current/local iobroker.procon-ip
COPY . /opt/iobroker.procon-ip

# Change workdir and install iobroker
WORKDIR /opt/iobroker
ENV AUTOMATED_INSTALLER 1
RUN npm i iobroker && npm i --production --unsafe-perm
RUN ln -s /opt/iobroker.procon-ip /opt/iobroker/node_modules/iobroker.procon-ip

# Manually run the iobroker.js-controller to get the console output
ENTRYPOINT ["node", "/opt/iobroker/node_modules/iobroker.js-controller/controller.js"]

EXPOSE 8081
